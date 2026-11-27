from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.deps import get_current_organizer, get_current_user
from app.errors import AppError, conflict, forbidden
from app.models import Organizer, User, UserRole, VerificationStatus
from app.schemas.organizers import OrganizerCreate, OrganizerOut, OrganizerUpdate, VerificationSubmit
from app.services.audit import log_action
from app.utils import slugify, unique_suffix

router = APIRouter(tags=["organizer"])


async def _unique_slug(session: AsyncSession, name: str) -> str:
    base = slugify(name, "organizer")
    if await session.scalar(select(Organizer.id).where(Organizer.slug == base)) is None:
        return base
    return f"{base}-{unique_suffix()}"


def _apply(org: Organizer, data: dict) -> None:
    social = data.pop("social_links", None)
    if social is not None:
        org.social_links = social.to_json() if hasattr(social, "to_json") else {k: str(v) for k, v in social.items() if v}
    for key, value in data.items():
        setattr(org, key, str(value) if key == "logo_url" and value else value)


@router.post("/organizers", response_model=OrganizerOut, status_code=201)
async def create_organizer(
    body: OrganizerCreate, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    """Onboarding: turns the signed-in account into an organizer."""
    if user.role == UserRole.admin:
        raise forbidden("Admin accounts can't host events. Use a separate account.")
    if await session.scalar(select(Organizer.id).where(Organizer.user_id == user.id)):
        raise conflict("organizer_exists", "You already have an organizer profile.")
    org = Organizer(
        user_id=user.id, name=body.name, type=body.type, slug=await _unique_slug(session, body.name),
        platform_fee_bps=get_settings().default_platform_fee_bps, social_links={},
    )
    _apply(org, body.model_dump(exclude_unset=True, exclude={"name", "type"}))
    user.role = UserRole.organizer
    session.add(org)
    try:
        await session.flush()
    except IntegrityError:  # two requests racing on the same slug or user
        await session.rollback()
        raise conflict("organizer_exists", "That name was just taken or you already have a profile. Try again.") from None
    log_action(session, user, "organizer.create", "organizer", org.id)
    await session.commit()
    return org


@router.get("/organizers/me", response_model=OrganizerOut)
async def get_my_organizer(org: Organizer = Depends(get_current_organizer)):
    return org


@router.patch("/organizers/me", response_model=OrganizerOut)
async def update_my_organizer(
    body: OrganizerUpdate,
    org: Organizer = Depends(get_current_organizer),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    data = body.model_dump(exclude_unset=True)
    for required in ("name", "type"):
        if required in data and data[required] is None:
            raise AppError(422, "validation_error", f"{required} can't be empty.")
    _apply(org, data)  # slug stays stable so shared links keep working
    log_action(session, user, "organizer.update", "organizer", org.id)
    await session.commit()
    return org


@router.post("/organizers/me/verification", response_model=OrganizerOut)
async def submit_verification(
    body: VerificationSubmit,
    org: Organizer = Depends(get_current_organizer),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Optional step: unlocks paid tickets once an admin approves it."""
    if org.verification_status in (VerificationStatus.pending, VerificationStatus.verified):
        raise conflict("already_submitted", f"Your verification is already {org.verification_status.value}.")
    if not body.document_key.startswith("private/"):
        raise AppError(422, "validation_error", "Upload the document with kind=document first.")
    org.verification_doc_type = body.document_type
    org.verification_doc_number = body.document_number
    org.verification_document_key = body.document_key
    org.verification_status = VerificationStatus.pending
    org.verification_note = None
    log_action(session, user, "organizer.verification_submit", "organizer", org.id, {"type": body.document_type})
    await session.commit()
    return org
