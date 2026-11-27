"""SQLAlchemy 2.0 models.

Conventions
- UUID primary keys generated in Python.
- All timestamps are timezone-aware and stored in UTC (UTCDateTime also keeps
  SQLite, used in tests, honest about tz).
- Money is whole NPR rupees (int). Khalti/eSewa amounts are derived from it.
- Enums are stored as plain strings with a CHECK constraint (no native PG
  enums), which keeps migrations simple.
"""

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """Timezone-aware datetimes in, UTC-aware datetimes out (also on SQLite)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetime not allowed; use timezone-aware values")
        return value.astimezone(UTC)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


JSONType = JSON().with_variant(JSONB(), "postgresql")


def _enum(cls: type[enum.Enum]) -> Enum:
    return Enum(
        cls,
        native_enum=False,
        length=24,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
    )


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


# ----------------------------------------------------------------- enums
class UserRole(enum.StrEnum):
    attendee = "attendee"
    organizer = "organizer"
    admin = "admin"


class OrganizerType(enum.StrEnum):
    club = "club"
    venue = "venue"
    restaurant = "restaurant"
    promoter = "promoter"
    individual = "individual"


class VerificationStatus(enum.StrEnum):
    none = "none"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class EventCategory(enum.StrEnum):
    fitness = "fitness"
    shows = "shows"
    bites = "bites"
    activities = "activities"
    nightlife = "nightlife"
    outdoors = "outdoors"


class EventStatus(enum.StrEnum):
    draft = "draft"
    in_review = "in_review"
    live = "live"
    ended = "ended"
    cancelled = "cancelled"
    rejected = "rejected"


class BookingStatus(enum.StrEnum):
    pending = "pending"
    paid = "paid"  # confirmed: paid, or free
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentProvider(enum.StrEnum):
    khalti = "khalti"
    esewa = "esewa"


class PaymentStatus(enum.StrEnum):
    initiated = "initiated"
    completed = "completed"
    failed = "failed"
    refund_pending = "refund_pending"  # owed to the customer, not yet sent
    refunded = "refunded"


class PayoutRequestStatus(enum.StrEnum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"


# ----------------------------------------------------------------- tables
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)  # E.164
    email: Mapped[str | None] = mapped_column(String(254), unique=True)  # lowercased
    name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[UserRole] = mapped_column(_enum(UserRole), default=UserRole.attendee)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    organizer: Mapped["Organizer | None"] = relationship(back_populates="user", uselist=False)

    __table_args__ = (
        CheckConstraint("phone IS NOT NULL OR email IS NOT NULL", name="ck_users_has_contact"),
    )


class Organizer(Base):
    __tablename__ = "organizers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[OrganizerType] = mapped_column(_enum(OrganizerType))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(20))
    social_links: Mapped[dict] = mapped_column(JSONType, default=dict)
    address: Mapped[str | None] = mapped_column(String(300))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        _enum(VerificationStatus), default=VerificationStatus.none
    )
    verification_doc_type: Mapped[str | None] = mapped_column(String(20))  # pan | vat | national_id ...
    verification_doc_number: Mapped[str | None] = mapped_column(String(40))
    # Storage key of the private document image. Never exposed publicly.
    verification_document_key: Mapped[str | None] = mapped_column(String(200))
    verification_note: Mapped[str | None] = mapped_column(String(500))  # admin reason
    platform_fee_bps: Mapped[int] = mapped_column(Integer, default=800)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="organizer")
    events: Mapped[list["Event"]] = relationship(back_populates="organizer")

    __table_args__ = (
        CheckConstraint("platform_fee_bps BETWEEN 0 AND 5000", name="ck_organizers_fee_range"),
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizers.id"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    category: Mapped[EventCategory] = mapped_column(_enum(EventCategory))
    description: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    venue_name: Mapped[str | None] = mapped_column(String(160))
    address: Mapped[str | None] = mapped_column(String(300))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    starts_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ends_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    registration_deadline: Mapped[datetime | None] = mapped_column(UTCDateTime)
    status: Mapped[EventStatus] = mapped_column(_enum(EventStatus), default=EventStatus.draft)
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    # Subset of RFC 5545, e.g. "FREQ=WEEKLY;UNTIL=20270101". Only weekly is supported.
    recurrence_rule: Mapped[str | None] = mapped_column(String(120))
    recurrence_spawned: Mapped[bool] = mapped_column(Boolean, default=False)
    reminders_24h_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    reminders_2h_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    organizer: Mapped[Organizer] = relationship(back_populates="events")
    images: Mapped[list["EventImage"]] = relationship(
        back_populates="event", order_by="EventImage.position", cascade="all, delete-orphan"
    )
    ticket_types: Mapped[list["TicketType"]] = relationship(
        back_populates="event", order_by="TicketType.position", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Public listing: live events in a time window.
        Index("ix_events_status_starts", "status", "starts_at"),
        # Bounding-box prefilter for "near me": only live rows are indexed, which keeps
        # the index small. (Swap for a PostGIS GiST index on geography if volume grows.)
        Index(
            "ix_events_live_geo",
            "starts_at",
            "lat",
            "lng",
            postgresql_where=text("status = 'live'"),
            sqlite_where=text("status = 'live'"),
        ),
        Index("ix_events_organizer_status", "organizer_id", "status"),
        CheckConstraint("ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at", name="ck_events_time_order"),
        CheckConstraint("lat IS NULL OR lat BETWEEN -90 AND 90", name="ck_events_lat"),
        CheckConstraint("lng IS NULL OR lng BETWEEN -180 AND 180", name="ck_events_lng"),
    )


class EventImage(Base):
    __tablename__ = "event_images"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0)

    event: Mapped[Event] = relationship(back_populates="images")


class TicketType(Base):
    __tablename__ = "ticket_types"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    price_npr: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer)
    # Seats held by pending + paid bookings. Only ever changed by atomic UPDATEs
    # (see services/bookings.py) so the capacity check cannot race.
    sold: Mapped[int] = mapped_column(Integer, default=0)
    max_per_user: Mapped[int] = mapped_column(Integer, default=10)
    sales_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    sales_end: Mapped[datetime | None] = mapped_column(UTCDateTime)
    position: Mapped[int] = mapped_column(Integer, default=0)

    event: Mapped[Event] = relationship(back_populates="ticket_types")

    __table_args__ = (
        CheckConstraint("price_npr >= 0", name="ck_ticket_price"),
        CheckConstraint("capacity > 0", name="ck_ticket_capacity"),
        CheckConstraint("sold >= 0 AND sold <= capacity", name="ck_ticket_sold_within_capacity"),
        CheckConstraint("max_per_user > 0", name="ck_ticket_max_per_user"),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), index=True)
    status: Mapped[BookingStatus] = mapped_column(_enum(BookingStatus), default=BookingStatus.pending)
    total_npr: Mapped[int] = mapped_column(Integer, default=0)
    platform_fee_npr: Mapped[int] = mapped_column(Integer, default=0)
    payment_ref: Mapped[str | None] = mapped_column(String(120), unique=True)
    # Same key from the same user returns the same booking (safe client retries).
    idempotency_key: Mapped[str | None] = mapped_column(String(80))
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime)  # for pending holds
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    cancelled_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    items: Mapped[list["BookingItem"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    event: Mapped[Event] = relationship()
    user: Mapped[User] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking")

    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_bookings_user_idem"),
        Index("ix_bookings_event_status", "event_id", "status"),
        Index("ix_bookings_pending_expiry", "expires_at", postgresql_where=text("status = 'pending'"),
              sqlite_where=text("status = 'pending'")),
        CheckConstraint("total_npr >= 0", name="ck_bookings_total"),
    )


class BookingItem(Base):
    __tablename__ = "booking_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    ticket_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ticket_types.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_npr: Mapped[int] = mapped_column(Integer, default=0)
    # Signed token (see security.make_qr_token). One scan admits `quantity` people.
    qr_token: Mapped[str] = mapped_column(String(120), unique=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    checked_in_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    booking: Mapped[Booking] = relationship(back_populates="items")
    ticket_type: Mapped[TicketType] = relationship()

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_items_quantity"),)


class Payment(Base):
    """One attempt to pay for a booking with a provider."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), index=True)
    provider: Mapped[PaymentProvider] = mapped_column(_enum(PaymentProvider))
    status: Mapped[PaymentStatus] = mapped_column(_enum(PaymentStatus), default=PaymentStatus.initiated)
    amount_npr: Mapped[int] = mapped_column(Integer)
    # Khalti: pidx. eSewa: our transaction_uuid. Unique so a payment is confirmed once.
    provider_ref: Mapped[str] = mapped_column(String(120), unique=True)
    provider_txn_id: Mapped[str | None] = mapped_column(String(120))
    raw: Mapped[dict | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    booking: Mapped[Booking] = relationship(back_populates="payments")


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizers.id"), index=True)
    amount_npr: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[PayoutRequestStatus] = mapped_column(
        _enum(PayoutRequestStatus), default=PayoutRequestStatus.requested
    )
    method: Mapped[str] = mapped_column(String(20))  # bank | khalti | esewa
    account_details: Mapped[dict] = mapped_column(JSONType, default=dict)
    note: Mapped[str | None] = mapped_column(String(500))
    requested_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    __table_args__ = (CheckConstraint("amount_npr > 0", name="ck_payout_request_amount"),)


class Payout(Base):
    """Money actually sent to an organizer (one per paid payout request)."""

    __tablename__ = "payouts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizers.id"), index=True)
    payout_request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payout_requests.id"), unique=True)
    amount_npr: Mapped[int] = mapped_column(BigInteger)
    reference: Mapped[str | None] = mapped_column(String(120))  # bank/wallet transfer id
    paid_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    data: Mapped[dict | None] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)
