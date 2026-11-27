import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models import BookingStatus


class BookingItemIn(BaseModel):
    ticket_type_id: uuid.UUID
    quantity: int = Field(ge=1, le=10)


class BookingCreate(BaseModel):
    event_id: uuid.UUID
    items: list[BookingItemIn] = Field(min_length=1, max_length=10)

    @field_validator("items")
    @classmethod
    def _unique_tickets(cls, items: list[BookingItemIn]) -> list[BookingItemIn]:
        if len({i.ticket_type_id for i in items}) != len(items):
            raise ValueError("List each ticket type once and change its quantity instead.")
        return items


class EventBrief(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    starts_at: datetime | None
    venue_name: str | None
    address: str | None
    cover_image_url: str | None


class BookingItemOut(BaseModel):
    id: uuid.UUID
    ticket_type_id: uuid.UUID
    ticket_name: str
    quantity: int
    unit_price_npr: int
    qr_token: str | None  # only once the booking is confirmed
    checked_in_at: datetime | None


class BookingOut(BaseModel):
    id: uuid.UUID
    status: BookingStatus
    total_npr: int
    expires_at: datetime | None  # unpaid holds only
    created_at: datetime
    cancelled_at: datetime | None
    refund_npr: int  # amount owed back to the attendee (0 if none)
    event: EventBrief
    items: list[BookingItemOut]


class BookingList(BaseModel):
    items: list[BookingOut]
    next_cursor: str | None


class AttendeeRow(BaseModel):
    """One ticket line of a booking, as an organizer sees it."""

    id: uuid.UUID  # booking item id
    booking_id: uuid.UUID
    attendee_name: str | None
    attendee_phone: str | None
    ticket_name: str
    quantity: int
    status: BookingStatus
    total_npr: int
    checked_in_at: datetime | None
    qr_token: str | None
    created_at: datetime


class AttendeeList(BaseModel):
    items: list[AttendeeRow]
    next_cursor: str | None


class ScanIn(BaseModel):
    qr_token: str = Field(min_length=10, max_length=200)
    event_id: uuid.UUID


class ScanOut(BaseModel):
    result: str  # valid | already_used | invalid | wrong_event
    attendee_name: str | None = None
    ticket_name: str | None = None
    quantity: int | None = None
    checked_in_at: datetime | None = None


class AnnounceIn(BaseModel):
    subject: str | None = Field(default=None, max_length=80)
    message: str = Field(min_length=3, max_length=240)


class AnnounceOut(BaseModel):
    recipients: int


class CancelEventIn(BaseModel):
    reason: str | None = Field(default=None, max_length=200)
