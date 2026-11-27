import hashlib
import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.db import get_session
from app.errors import AppError, bad_request, not_found
from app.models import Event, EventCategory, EventStatus, Organizer, VerificationStatus
from app.redis import get_redis
from app.schemas.events import EventDetail, EventList, OrganizerPublic
from app.services import events_query as eq
from app.utils import NPT

router = APIRouter(tags=["public"])

CACHE_SECONDS = 60


def _as_aware(value: datetime | None) -> datetime | None:
    return value if value is None or value.tzinfo else value.replace(tzinfo=NPT)


@router.get("/events", response_model=EventList)
async def list_events(
    response: Response,
    lat: Annotated[float | None, Query(ge=-90, le=90)] = None,
    lng: Annotated[float | None, Query(ge=-180, le=180)] = None,
    radius_km: Annotated[float, Query(gt=0, le=200)] = 15,
    from_: Annotated[datetime | None, Query(alias="from", description="Default: now")] = None,
    to: Annotated[datetime | None, Query(description="Default: 7 days after `from`")] = None,
    category: EventCategory | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    cursor: str | None = None,
    session: AsyncSession = Depends(get_session),
    redis: Redis = Depends(get_redis),
):
    """Live events near a point, best first. Ranked by `going / (1 + distance_km / 10)`.

    Without lat/lng the radius is ignored and `distance_km` is null.
    Results are cached for 60 seconds.
    """
    if (lat is None) != (lng is None):
        raise bad_request("lat_lng_pair", "Send both lat and lng, or neither.")
    from_, to = _as_aware(from_), _as_aware(to)
    if from_ and to and to <= from_:
        raise bad_request("bad_range", "'to' must be after 'from'.")
    decoded = None
    if cursor:
        decoded = eq.decode_cursor(cursor)
        if decoded is None:
            raise bad_request("bad_cursor", "That page link is not valid. Start again from the first page.")

    # ~110 m precision: great for cache hit rate, and avoids exact-location logging.
    lat_r = None if lat is None else round(lat, 3)
    lng_r = None if lng is None else round(lng, 3)
    key_src = json.dumps(
        [lat_r, lng_r, radius_km, from_ and from_.isoformat(), to and to.isoformat(), category and category.value, q, limit, cursor]
    )
    key = "events:list:" + hashlib.sha1(key_src.encode()).hexdigest()

    cached = await redis.get(key)
    if cached:
        response.headers["X-Cache"] = "HIT"
        return EventList.model_validate_json(cached)

    items, next_cursor = await eq.search_events(
        session, lat=lat_r, lng=lng_r, radius_km=radius_km, start=from_, end=to,
        category=category.value if category else None, q=q, limit=limit, cursor=decoded,
    )
    result = EventList(items=items, next_cursor=next_cursor)
    await redis.set(key, result.model_dump_json(), ex=CACHE_SECONDS)
    response.headers["X-Cache"] = "MISS"
    return result


@router.get("/events/{slug}", response_model=EventDetail)
async def get_event(slug: str, session: AsyncSession = Depends(get_session)):
    event = await session.scalar(
        select(Event)
        .where(Event.slug == slug, Event.status == EventStatus.live)  # only live events are public
        .options(joinedload(Event.organizer), selectinload(Event.ticket_types), selectinload(Event.images))
    )
    if event is None:
        raise not_found("Event")
    going = (await eq.going_counts(session, [event.id])).get(event.id, 0)
    now = datetime.now(NPT)
    return EventDetail(
        **eq.card_fields(event, going, None),
        description=event.description,
        gallery=[i.url for i in event.images],
        registration_deadline=event.registration_deadline,
        recurrence_rule=event.recurrence_rule,
        ticket_types=[eq.public_ticket(t, event, now) for t in event.ticket_types],
    )


@router.get("/organizers/{slug}", response_model=OrganizerPublic)
async def get_organizer(slug: str, session: AsyncSession = Depends(get_session)):
    org = await session.scalar(select(Organizer).where(Organizer.slug == slug))
    if org is None:
        raise not_found("Organizer")
    events = list(
        (
            await session.scalars(
                select(Event)
                .where(Event.organizer_id == org.id, Event.status == EventStatus.live)
                .options(joinedload(Event.organizer), selectinload(Event.ticket_types))
                .order_by(Event.starts_at)
                .limit(20)
            )
        ).unique()
    )
    going = await eq.going_counts(session, [e.id for e in events])
    return OrganizerPublic(
        id=org.id, name=org.name, slug=org.slug, type=org.type, logo_url=org.logo_url, bio=org.bio,
        social_links=org.social_links or {}, address=org.address,
        verified=org.verification_status == VerificationStatus.verified,
        upcoming_events=[eq.to_card(e, going.get(e.id, 0), None) for e in events],
    )
