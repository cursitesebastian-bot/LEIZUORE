import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.models import EventCategory, EventStatus, OrganizerType
from app.utils import NPT


def _to_aware(value: datetime) -> datetime:
    """Naive input is read as Asia/Kathmandu time (what a host types); stored as UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=NPT)
    return value


AwareDT = Annotated[datetime, AfterValidator(_to_aware)]


def size_label(going: int) -> str:
    if going < 50:
        return "Intimate"
    if going < 300:
        return "Medium"
    if going < 1000:
        return "Large"
    return "Huge"


# ------------------------------------------------------------------ public
class OrganizerMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None
    verified: bool = False


class EventCard(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    category: EventCategory
    cover_image_url: str | None
    venue_name: str | None
    address: str | None
    lat: float | None
    lng: float | None
    is_online: bool
    starts_at: datetime
    ends_at: datetime | None
    distance_km: float | None = Field(description="Straight-line km from the search point; null without lat/lng")
    going: int = Field(description="People with a confirmed booking")
    size_label: str = Field(description="Intimate <50, Medium <300, Large <1000, Huge 1000+")
    trending_score: float
    min_price_npr: int | None
    is_free: bool
    organizer: OrganizerMini


class EventList(BaseModel):
    items: list[EventCard]
    next_cursor: str | None


class PublicTicketType(BaseModel):
    id: uuid.UUID
    name: str
    price_npr: int
    remaining: int
    max_per_user: int
    on_sale: bool
    sales_start: datetime | None
    sales_end: datetime | None


class EventDetail(EventCard):
    description: str | None
    gallery: list[str]
    registration_deadline: datetime | None
    recurrence_rule: str | None
    ticket_types: list[PublicTicketType]


class OrganizerPublic(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    type: OrganizerType
    logo_url: str | None
    bio: str | None
    social_links: dict
    address: str | None
    verified: bool
    upcoming_events: list[EventCard]


# ------------------------------------------------------------ organizer side
class TicketTypeIn(BaseModel):
    id: uuid.UUID | None = Field(default=None, description="Send the id to update an existing ticket type")
    name: str = Field(min_length=1, max_length=80)
    price_npr: int = Field(ge=0, le=1_000_000, description="Whole rupees; 0 = free")
    capacity: int = Field(gt=0, le=100_000)
    max_per_user: int = Field(default=10, gt=0, le=50)
    sales_start: AwareDT | None = None
    sales_end: AwareDT | None = None

    @model_validator(mode="after")
    def check_window(self):
        if self.sales_start and self.sales_end and self.sales_end <= self.sales_start:
            raise ValueError("Ticket sales must end after they start")
        if self.max_per_user > self.capacity:
            self.max_per_user = self.capacity
        return self


_RRULE_PREFIX = "FREQ=WEEKLY"


class EventFields(BaseModel):
    description: str | None = Field(default=None, max_length=5000)
    cover_image_url: HttpUrl | None = None
    gallery_urls: list[HttpUrl] | None = Field(default=None, max_length=5, description="Up to 5 gallery images")
    venue_name: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=300)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    is_online: bool | None = None
    starts_at: AwareDT | None = None
    ends_at: AwareDT | None = None
    registration_deadline: AwareDT | None = None
    recurrence_rule: str | None = Field(default=None, max_length=120, description="Only weekly: FREQ=WEEKLY[;UNTIL=YYYYMMDD]")
    ticket_types: list[TicketTypeIn] | None = Field(default=None, max_length=10)

    @field_validator("recurrence_rule")
    @classmethod
    def weekly_only(cls, v):
        if v in (None, ""):
            return None
        if not v.startswith(_RRULE_PREFIX):
            raise ValueError("Only weekly repeats are supported")
        return v

    @model_validator(mode="after")
    def check_times(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("The event must end after it starts")
        if self.starts_at and self.registration_deadline and self.registration_deadline > self.starts_at:
            raise ValueError("Registration must close before the event starts")
        return self


class EventCreate(EventFields):
    title: str = Field(min_length=3, max_length=140)
    category: EventCategory


class EventUpdate(EventFields):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    category: EventCategory | None = None


class TicketTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    price_npr: int
    capacity: int
    sold: int
    max_per_user: int
    sales_start: datetime | None
    sales_end: datetime | None


class OrganizerEventOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    category: EventCategory
    status: EventStatus
    rejection_reason: str | None
    description: str | None
    cover_image_url: str | None
    gallery_urls: list[str]
    venue_name: str | None
    address: str | None
    lat: float | None
    lng: float | None
    is_online: bool
    starts_at: datetime | None
    ends_at: datetime | None
    registration_deadline: datetime | None
    recurrence_rule: str | None
    ticket_types: list[TicketTypeOut]
    tickets_sold: int
    revenue_npr: int
    created_at: datetime
    updated_at: datetime
    notice: str | None = Field(default=None, description="Set when an edit sent a live event back to review")


class OrganizerEventList(BaseModel):
    items: list[OrganizerEventOut]
    next_cursor: str | None


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500, description="Shown to the host")
