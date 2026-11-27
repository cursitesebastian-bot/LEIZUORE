from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_current_user
from app.models import Organizer, User
from app.ratelimit import rate_limit
from app.redis import get_redis
from app.schemas.auth import AuthResponse, OtpRequest, OtpSent, OtpVerify, RefreshRequest, UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


async def _user_out(session: AsyncSession, user: User) -> UserOut:
    organizer_id = await session.scalar(select(Organizer.id).where(Organizer.user_id == user.id))
    out = UserOut.model_validate(user)
    out.organizer_id = organizer_id
    return out


@router.post("/otp/request", response_model=OtpSent, dependencies=[Depends(rate_limit("otp_request", 20, 600))])
async def request_otp(body: OtpRequest, redis: Redis = Depends(get_redis)):
    """Send a 6-digit code by SMS (phone) or email. Codes expire in 5 minutes."""
    return OtpSent(expires_in=await auth_service.request_otp(redis, body.channel, body.identifier))


@router.post("/otp/verify", response_model=AuthResponse, dependencies=[Depends(rate_limit("otp_verify", 40, 600))])
async def verify_otp(body: OtpVerify, redis: Redis = Depends(get_redis), session: AsyncSession = Depends(get_session)):
    """Check the code. Creates the account on first sign-in and returns tokens."""
    await auth_service.verify_otp(redis, body.identifier, body.code)
    user = await auth_service.get_or_create_user(session, body.channel, body.identifier, body.name)
    await session.commit()
    tokens = await auth_service.issue_tokens(redis, user.id)
    return AuthResponse(**tokens, user=await _user_out(session, user))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(body: RefreshRequest, redis: Redis = Depends(get_redis), session: AsyncSession = Depends(get_session)):
    """Swap a refresh token for a new pair. Each refresh token works once."""
    user, tokens = await auth_service.rotate_refresh(redis, session, body.refresh_token)
    return AuthResponse(**tokens, user=await _user_out(session, user))


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, redis: Redis = Depends(get_redis)):
    await auth_service.revoke_refresh(redis, body.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return await _user_out(session, user)
