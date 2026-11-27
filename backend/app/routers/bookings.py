import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import queue
from app.db import get_session
from app.deps import get_current_user
from app.errors import AppError
from app.models import Booking, BookingStatus, User
from app.ratelimit import rate_limit
from app.schemas.bookings import BookingCreate, BookingList, BookingOut
from app.services import bookings as svc
from app.services.event_service import decode_page, encode_page

router = APIRouter(tags=["bookings"])


@router.post(
    "/bookings",
    response_model=BookingOut,
    status_code=201,
    dependencies=[Depends(rate_limit("book", 30, 60))],
    responses={200: {"description": "Same Idempotency-Key as an earlier request: that booking is returned."}},
)
async def create_booking(
    body: BookingCreate,
    response: Response,
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=80,
                           description="Random string per booking attempt. Retrying with the same key never double-books.")
    ] = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Reserve tickets. Free tickets are confirmed immediately. Paid tickets are held
    for 15 minutes (`expires_at`) while the attendee pays; unpaid holds are released."""
    if not idempotency_key:
        raise AppError(400, "idempotency_key_required", "Send an Idempotency-Key header so retries can't double-book.")
    booking, created = await svc.create_booking(session, user, body, idempotency_key)
    await session.commit()
    out = svc.booking_out(await svc.get_booking(session, booking.id))
    await session.commit()  # end the read transaction before the inline job opens its own session
    if not created:
        response.status_code = 200
    elif out.status == BookingStatus.paid:  # free ticket: confirm right away
        await queue.enqueue(
            "notify_user", str(user.id), "You're in",
            f"Your ticket for {out.event.title} is ready under My bookings on ZOURE.",
        )
    return out


@router.get("/bookings/me", response_model=BookingList)
async def my_bookings(
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Booking).where(Booking.user_id == user.id).options(*svc._load_options())
    if cursor:
        decoded = decode_page(cursor)
        if decoded is None:
            raise AppError(400, "bad_cursor", "That page link is not valid. Start again from the first page.")
        at, bid = decoded
        stmt = stmt.where(or_(Booking.created_at < at, and_(Booking.created_at == at, Booking.id < bid)))
    rows = list((await session.scalars(stmt.order_by(Booking.created_at.desc(), Booking.id.desc()).limit(limit + 1))).all())
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = encode_page(rows[-1].created_at, rows[-1].id)
    return BookingList(items=[svc.booking_out(b) for b in rows], next_cursor=next_cursor)


@router.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_my_booking(booking_id: uuid.UUID, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return svc.booking_out(await svc.get_booking(session, booking_id, user.id))


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
async def cancel_my_booking(booking_id: uuid.UUID, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Cancel and release the seats. Paid tickets are refunded in full up to 24 hours before the start."""
    await svc.cancel_booking(session, user, booking_id)
    await session.commit()
    return svc.booking_out(await svc.get_booking(session, booking_id, user.id))
