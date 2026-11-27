"""Reusable auth and permission dependencies.

    user      = Depends(get_current_user)                  any signed-in user
    admin     = Depends(require_roles(UserRole.admin))     role gate
    organizer = Depends(get_current_organizer)             organizer profile of the caller
    event     = Depends(get_owned_event)                   event the caller owns (404 otherwise)

Roles are read from the database on every request (not from the JWT), so a
demotion or ban takes effect immediately.
"""

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.errors import forbidden, not_found, unauthorized
from app.models import Event, Organizer, User, UserRole
from app.security import decode_token

bearer = HTTPBearer(auto_error=False, description="Access token from /auth/otp/verify")


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    if creds is None:
        raise unauthorized()
    claims = decode_token(creds.credentials, "access")
    user = await session.get(User, uuid.UUID(claims["sub"]))
    if user is None:
        raise unauthorized()
    if not user.is_active:
        raise forbidden("This account has been disabled.")
    return user


async def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    return await get_current_user(creds, session) if creds else None


def require_roles(*roles: UserRole):
    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return dependency


require_admin = require_roles(UserRole.admin)


async def get_current_organizer(
    user: User = Depends(require_roles(UserRole.organizer)),
    session: AsyncSession = Depends(get_session),
) -> Organizer:
    organizer = await session.scalar(select(Organizer).where(Organizer.user_id == user.id))
    if organizer is None:
        raise forbidden("Finish setting up your organizer profile first.")
    return organizer


async def get_owned_event(
    event_id: uuid.UUID,
    organizer: Organizer = Depends(get_current_organizer),
    session: AsyncSession = Depends(get_session),
) -> Event:
    """Organizers only ever see their own events. Someone else's event is a 404,
    not a 403, so ids cannot be probed."""
    event = await session.scalar(
        select(Event)
        .where(Event.id == event_id, Event.organizer_id == organizer.id)
        .options(selectinload(Event.ticket_types), selectinload(Event.images))
    )
    if event is None:
        raise not_found("Event")
    return event
