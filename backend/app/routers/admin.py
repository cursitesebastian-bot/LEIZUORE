import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import queue
from app.db import get_session
from app.deps import require_admin
from app.errors import conflict, not_found
from app.models import Event, EventStatus, Organizer, User, VerificationStatus
from app.schemas.events import OrganizerEventOut, RejectIn
from app.schemas.organizers import OrganizerOut, VerificationDecision, VerificationReject
from app.services import event_service as svc
from app.services.audit import log_action
from app.services.storage import get_storage

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminEventOut(OrganizerEventOut):
    organizer_id: uuid.UUID
    organizer_name: str
    organizer_verified: bool


class AdminEventList(BaseModel):
    items: list[AdminEventOut]
    next_cursor: str | None


class AdminOrganizerOut(OrganizerOut):
    verification_doc_type: str | None
    verification_doc_number: str | None
    verification_document_url: str | None = None  # short-lived signed URL


def _admin_event(event: Event, org: Organizer, stats=(0, 0)) -> AdminEventOut:
    return AdminEventOut(
        **svc.build_out(event, stats).model_dump(), organizer_id=org.id, organizer_name=org.name,
        organizer_verified=org.verification_status == VerificationStatus.verified,
    )


async def _load(session: AsyncSession, event_id: uuid.UUID) -> Event:
    event = await session.scalar(
        select(Event).where(Event.id == event_id)
        .options(selectinload(Event.ticket_types), selectinload(Event.images), selectinload(Event.organizer))
    )
    if event is None:
        raise not_found("Event")
    return event


@router.get("/events", response_model=AdminEventList)
async def review_queue(
    status: EventStatus = EventStatus.in_review,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: str | None = None,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    rows, next_cursor = await svc.list_events(session, organizer_id=None, status=status, limit=limit, cursor=cursor)
    orgs = {o.id: o for o in (await session.scalars(select(Organizer).where(Organizer.id.in_({e.organizer_id for e in rows})))).all()} if rows else {}
    return AdminEventList(items=[_admin_event(e, orgs[e.organizer_id]) for e in rows], next_cursor=next_cursor)


@router.post("/events/{event_id}/approve", response_model=AdminEventOut)
async def approve_event(event_id: uuid.UUID, admin: User = Depends(require_admin), session: AsyncSession = Depends(get_session)):
    event = await _load(session, event_id)
    if event.status != EventStatus.in_review:
        raise conflict("bad_status", f"Only events in review can be approved (this one is {event.status.value}).")
    errors = svc.completeness_errors(event, event.organizer)  # e.g. organizer lost verification meanwhile
    if errors:
        raise conflict("event_incomplete", errors[0]["message"])
    event.status = EventStatus.live
    event.rejection_reason = None
    log_action(session, admin, "event.approve", "event", event.id)
    await session.commit()
    await queue.enqueue("notify_user", str(event.organizer.user_id), "ZOURE", f"'{event.title}' is live. Share your event link!")
    return _admin_event(event, event.organizer)


@router.post("/events/{event_id}/reject", response_model=AdminEventOut)
async def reject_event(
    event_id: uuid.UUID, body: RejectIn, admin: User = Depends(require_admin), session: AsyncSession = Depends(get_session)
):
    event = await _load(session, event_id)
    if event.status != EventStatus.in_review:
        raise conflict("bad_status", f"Only events in review can be rejected (this one is {event.status.value}).")
    event.status = EventStatus.rejected
    event.rejection_reason = body.reason
    log_action(session, admin, "event.reject", "event", event.id, {"reason": body.reason})
    await session.commit()
    await queue.enqueue(
        "notify_user", str(event.organizer.user_id), "ZOURE", f"'{event.title}' needs changes: {body.reason}"
    )
    return _admin_event(event, event.organizer)


# ---------------------------------------------------------- organizer verification
async def _org(session: AsyncSession, organizer_id: uuid.UUID) -> Organizer:
    org = await session.get(Organizer, organizer_id)
    if org is None:
        raise not_found("Organizer")
    return org


def _org_out(org: Organizer) -> AdminOrganizerOut:
    out = AdminOrganizerOut.model_validate(org)
    if org.verification_document_key:
        out.verification_document_url = get_storage().private_url(org.verification_document_key)
    return out


@router.get("/organizers", response_model=list[AdminOrganizerOut])
async def verification_queue(
    verification: VerificationStatus = VerificationStatus.pending,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    orgs = (await session.scalars(select(Organizer).where(Organizer.verification_status == verification).limit(100))).all()
    return [_org_out(o) for o in orgs]


@router.post("/organizers/{organizer_id}/verify", response_model=AdminOrganizerOut)
async def verify_organizer(
    organizer_id: uuid.UUID, body: VerificationDecision, admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    org = await _org(session, organizer_id)
    if org.verification_status != VerificationStatus.pending:
        raise conflict("bad_status", "Only pending verifications can be approved.")
    org.verification_status, org.verification_note = VerificationStatus.verified, body.note
    log_action(session, admin, "organizer.verify", "organizer", org.id)
    await session.commit()
    await queue.enqueue("notify_user", str(org.user_id), "ZOURE", "You're verified. You can now sell paid tickets.")
    return _org_out(org)


@router.post("/organizers/{organizer_id}/reject-verification", response_model=AdminOrganizerOut)
async def reject_verification(
    organizer_id: uuid.UUID, body: VerificationReject, admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    org = await _org(session, organizer_id)
    if org.verification_status != VerificationStatus.pending:
        raise conflict("bad_status", "Only pending verifications can be rejected.")
    org.verification_status, org.verification_note = VerificationStatus.rejected, body.note
    log_action(session, admin, "organizer.verification_reject", "organizer", org.id, {"note": body.note})
    await session.commit()
    await queue.enqueue("notify_user", str(org.user_id), "ZOURE", f"We couldn't verify your account: {body.note}")
    return _org_out(org)
