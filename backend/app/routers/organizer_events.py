import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import queue
from app.db import get_session
from app.deps import get_current_organizer, get_current_user, get_owned_event
from app.errors import conflict
from app.models import Booking, BookingStatus, Event, EventStatus, Organizer, User, VerificationStatus
from app.schemas.bookings import CancelEventIn
from app.schemas.events import EventCreate, EventUpdate, OrganizerEventList, OrganizerEventOut
from app.services import bookings as bookings_svc
from app.services import event_service as svc
from app.services.audit import log_action

router = APIRouter(tags=["organizer events"])


@router.post("/events", response_model=OrganizerEventOut, status_code=201)
async def create_event(
    body: EventCreate,
    organizer: Organizer = Depends(get_current_organizer),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a draft. Only title and category are required; everything else can be filled in later."""
    event = await svc.create_draft(session, organizer, user, body)
    await session.commit()
    return await svc.event_out(session, await svc.reload_event(session, event.id))


@router.patch("/events/{event_id}", response_model=OrganizerEventOut)
async def update_event(
    body: EventUpdate,
    event: Event = Depends(get_owned_event),
    organizer: Organizer = Depends(get_current_organizer),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Autosave target. Send only the fields that changed.

    Changing the date, venue or price of a *live* event sends it back to review
    and notifies attendees; the response `notice` explains that.
    """
    notice = await svc.update_event(session, event, organizer, user, body)
    await session.commit()
    return await svc.event_out(session, await svc.reload_event(session, event.id), notice)


@router.post("/events/{event_id}/submit", response_model=OrganizerEventOut)
async def submit_event(
    event: Event = Depends(get_owned_event),
    organizer: Organizer = Depends(get_current_organizer),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await svc.submit_event(session, event, organizer, user)
    await session.commit()
    return await svc.event_out(session, event)


@router.post("/events/{event_id}/duplicate", response_model=OrganizerEventOut, status_code=201)
async def duplicate_event(
    event: Event = Depends(get_owned_event),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    clone = await svc.duplicate_event(session, event, user)
    await session.commit()
    return await svc.event_out(session, await svc.reload_event(session, clone.id))


@router.post("/events/{event_id}/cancel", response_model=OrganizerEventOut)
async def cancel_event(
    body: CancelEventIn | None = None,
    event: Event = Depends(get_owned_event),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cancel an event. Every booking is cancelled and every paid booking is refunded in full;
    attendees are messaged."""
    reason = body.reason if body else None
    user_ids = await bookings_svc.cancel_event(session, event, user, reason)
    await session.commit()
    text = f"{event.title} has been cancelled by the host." + (f" Reason: {reason}." if reason else "")
    text += " Any payment will be refunded in full."
    for uid in user_ids:
        await queue.enqueue("notify_user", str(uid), "Event cancelled", text)
    return await svc.event_out(session, await svc.reload_event(session, event.id))


@router.get("/organizer/events", response_model=OrganizerEventList)
async def list_my_events(
    status: EventStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: str | None = None,
    organizer: Organizer = Depends(get_current_organizer),
    session: AsyncSession = Depends(get_session),
):
    rows, next_cursor = await svc.list_events(session, organizer_id=organizer.id, status=status, limit=limit, cursor=cursor)
    stats = await svc.event_stats(session, [e.id for e in rows])
    return OrganizerEventList(items=[svc.build_out(e, stats.get(e.id, (0, 0))) for e in rows], next_cursor=next_cursor)


@router.get("/organizer/events/{event_id}", response_model=OrganizerEventOut)
async def get_my_event(event: Event = Depends(get_owned_event), session: AsyncSession = Depends(get_session)):
    return await svc.event_out(session, event)


class NextEvent(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    starts_at: datetime
    tickets_sold: int


class Dashboard(BaseModel):
    upcoming_events: int
    tickets_sold: int
    revenue_npr: int  # gross
    net_revenue_npr: int  # after platform fee
    drafts: int
    in_review: int
    next_event: NextEvent | None
    verification_status: VerificationStatus


@router.get("/organizer/dashboard", response_model=Dashboard)
async def dashboard(organizer: Organizer = Depends(get_current_organizer), session: AsyncSession = Depends(get_session)):
    """Everything here is computed from real bookings; nothing is estimated."""
    from app.models import BookingItem

    now = datetime.now(UTC)
    counts = dict(
        (await session.execute(
            select(Event.status, func.count()).where(Event.organizer_id == organizer.id).group_by(Event.status)
        )).all()
    )
    upcoming = await session.scalar(
        select(func.count()).where(
            Event.organizer_id == organizer.id, Event.status == EventStatus.live, Event.starts_at > now
        )
    )
    revenue, fees = (
        await session.execute(
            select(func.coalesce(func.sum(Booking.total_npr), 0), func.coalesce(func.sum(Booking.platform_fee_npr), 0))
            .join(Event, Event.id == Booking.event_id)
            .where(Event.organizer_id == organizer.id, Booking.status == BookingStatus.paid)
        )
    ).one()
    sold = await session.scalar(
        select(func.coalesce(func.sum(BookingItem.quantity), 0))
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(Event, Event.id == Booking.event_id)
        .where(Event.organizer_id == organizer.id, Booking.status == BookingStatus.paid)
    )
    nxt = await session.scalar(
        select(Event)
        .where(Event.organizer_id == organizer.id, Event.status == EventStatus.live, Event.starts_at > now)
        .order_by(Event.starts_at)
        .limit(1)
    )
    next_event = None
    if nxt:
        n_sold = (await svc.event_stats(session, [nxt.id]))[nxt.id][0]
        next_event = NextEvent(id=nxt.id, slug=nxt.slug, title=nxt.title, starts_at=nxt.starts_at, tickets_sold=n_sold)
    return Dashboard(
        upcoming_events=upcoming or 0, tickets_sold=int(sold or 0), revenue_npr=int(revenue),
        net_revenue_npr=int(revenue) - int(fees), drafts=counts.get(EventStatus.draft, 0),
        in_review=counts.get(EventStatus.in_review, 0), next_event=next_event,
        verification_status=organizer.verification_status,
    )
