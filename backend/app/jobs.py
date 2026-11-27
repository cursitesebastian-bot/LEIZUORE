"""Background jobs (ARQ). Every job opens its own DB session and is safe to retry.

Run the worker with:  arq app.jobs.WorkerSettings
"""

import uuid

import structlog
from sqlalchemy import select

from app.db import get_sessionmaker
from app.models import Booking, BookingStatus, User
from app.services import messaging

log = structlog.get_logger()


async def notify_event_attendees(ctx, event_id: str, subject: str, body: str) -> int:
    """Message everyone holding a confirmed booking. Returns how many were messaged."""
    async with get_sessionmaker()() as session:
        users = (
            await session.scalars(
                select(User)
                .join(Booking, Booking.user_id == User.id)
                .where(Booking.event_id == uuid.UUID(event_id), Booking.status == BookingStatus.paid)
                .distinct()
            )
        ).all()
    for user in users:
        try:
            await messaging.send_to_user(user.phone, user.email, subject, body)
        except Exception:  # one bad number must not stop the rest
            log.exception("notify_failed", user_id=str(user.id))
    return len(users)


async def notify_user(ctx, user_id: str, subject: str, body: str) -> None:
    async with get_sessionmaker()() as session:
        user = await session.get(User, uuid.UUID(user_id))
    if user:
        await messaging.send_to_user(user.phone, user.email, subject, body)


async def expire_pending_bookings(ctx) -> int:
    """Release unpaid holds past their 15 minutes. Scheduled every minute (see WorkerSettings)."""
    from app.services import bookings

    async with get_sessionmaker()() as session:
        n = await bookings.expire_pending(session)
        await session.commit()
    if n:
        log.info("bookings_expired", count=n)
    return n
