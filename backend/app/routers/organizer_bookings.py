import csv
import io
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from redis.asyncio import Redis
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import queue
from app.db import get_session
from app.deps import get_current_organizer, get_current_user, get_owned_event
from app.errors import AppError
from app.models import Booking, BookingItem, BookingStatus, Event, Organizer, TicketType, User
from app.ratelimit import hit, rate_limit
from app.redis import get_redis
from app.schemas.bookings import AnnounceIn, AnnounceOut, AttendeeList, AttendeeRow, ScanIn, ScanOut
from app.services import bookings as svc
from app.services.audit import log_action
from app.services.event_service import decode_page, encode_page
from app.utils import NPT

router = APIRouter(tags=["organizer bookings"])

CSV_MAX_ROWS = 10_000


def _attendee_stmt(event: Event, q: str | None, status: BookingStatus | None):
    stmt = (
        select(BookingItem, Booking, TicketType, User)
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(TicketType, TicketType.id == BookingItem.ticket_type_id)
        .join(User, User.id == Booking.user_id)
        .where(Booking.event_id == event.id)
    )
    # Unpaid holds are not attendees; show them only when asked for explicitly.
    stmt = stmt.where(Booking.status == status) if status else stmt.where(Booking.status != BookingStatus.pending)
    if q:
        like = f"%{q.strip().lower().replace('%', '').replace('_', '')}%"
        stmt = stmt.where(
            or_(func.lower(User.name).like(like), func.lower(func.coalesce(User.email, "")).like(like),
                func.coalesce(User.phone, "").like(like))
        )
    return stmt


def _row(item: BookingItem, booking: Booking, ticket: TicketType, user: User) -> AttendeeRow:
    return AttendeeRow(
        id=item.id, booking_id=booking.id, attendee_name=user.name, attendee_phone=user.phone,
        ticket_name=ticket.name, quantity=item.quantity, status=booking.status,
        total_npr=item.quantity * item.unit_price_npr, checked_in_at=item.checked_in_at,
        qr_token=item.qr_token if booking.status == BookingStatus.paid else None, created_at=booking.created_at,
    )


def _csv_safe(value) -> str:
    """Stop spreadsheet apps from running attendee-typed text as a formula."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/organizer/events/{event_id}/bookings", response_model=AttendeeList, responses={200: {"content": {"text/csv": {}}}})
async def event_bookings(
    q: Annotated[str | None, Query(max_length=80, description="Name, phone or email")] = None,
    status: BookingStatus | None = None,
    format: Literal["json", "csv"] = "json",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: str | None = None,
    event: Event = Depends(get_owned_event),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Attendees of one of your events. `format=csv` downloads everything that matches (up to 10,000 rows)."""
    stmt = _attendee_stmt(event, q, status)
    order = (Booking.created_at.desc(), BookingItem.id.desc())

    if format == "csv":
        rows = (await session.execute(stmt.order_by(*order).limit(CSV_MAX_ROWS))).all()
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["Name", "Phone", "Ticket", "Quantity", "Status", "Total (NPR)", "Booked at (Nepal time)", "Checked in at (Nepal time)"])
        for item, booking, ticket, attendee in rows:
            writer.writerow([
                _csv_safe(attendee.name), _csv_safe(attendee.phone), _csv_safe(ticket.name), item.quantity,
                booking.status.value, item.quantity * item.unit_price_npr,
                booking.created_at.astimezone(NPT).strftime("%Y-%m-%d %H:%M"),
                item.checked_in_at.astimezone(NPT).strftime("%Y-%m-%d %H:%M") if item.checked_in_at else "",
            ])
        log_action(session, user, "bookings.export", "event", event.id, {"rows": len(rows)})
        await session.commit()
        return Response(
            "\ufeff" + out.getvalue(),  # BOM so Excel reads names correctly
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{event.slug[:50]}-attendees.csv"'},
        )

    if cursor:
        decoded = decode_page(cursor)
        if decoded is None:
            raise AppError(400, "bad_cursor", "That page link is not valid. Start again from the first page.")
        at, last_id = decoded
        stmt = stmt.where(or_(Booking.created_at < at, and_(Booking.created_at == at, BookingItem.id < last_id)))
    rows = (await session.execute(stmt.order_by(*order).limit(limit + 1))).all()
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = encode_page(rows[-1][1].created_at, rows[-1][0].id)
    return AttendeeList(items=[_row(*r) for r in rows], next_cursor=next_cursor)


@router.post("/organizer/events/{event_id}/announce", response_model=AnnounceOut)
async def announce(
    body: AnnounceIn,
    event: Event = Depends(get_owned_event),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
):
    """Message everyone with a confirmed booking (SMS, or email if they have no phone)."""
    await hit(redis, f"rl:announce:{event.id}", 3, 3600)  # keeps SMS costs and spam in check
    recipients = await session.scalar(
        select(func.count(func.distinct(Booking.user_id))).where(
            Booking.event_id == event.id, Booking.status == BookingStatus.paid
        )
    )
    if recipients:
        log_action(session, user, "event.announce", "event", event.id, {"recipients": recipients})
        await session.commit()
        await queue.enqueue("notify_event_attendees", str(event.id), body.subject or event.title, body.message)
    return AnnounceOut(recipients=recipients or 0)


@router.post("/checkin/scan", response_model=ScanOut, dependencies=[Depends(rate_limit("scan", 300, 60))])
async def scan(
    body: ScanIn,
    user: User = Depends(get_current_user),
    organizer: Organizer = Depends(get_current_organizer),
    session: AsyncSession = Depends(get_session),
):
    """Always answers 200 with a `result`, so the scanner can show big green or red feedback:
    valid | already_used | invalid | wrong_event. Only the event's own organizer can scan."""
    event = await session.scalar(select(Event).where(Event.id == body.event_id, Event.organizer_id == organizer.id))
    if event is None:
        raise AppError(404, "not_found", "Event was not found.")
    result = await svc.scan_ticket(session, user, event, body.qr_token)
    await session.commit()
    return result
