from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | production | test
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://zoure:zoure@localhost:5432/zoure"
    redis_url: str = "redis://localhost:6379/0"

    # Where the Next.js app lives. CORS is locked to this origin only.
    frontend_url: str = "http://localhost:3000"
    # Public URL of this API (used for payment callbacks and local uploads).
    api_public_url: str = "http://localhost:8000"

    # Secrets: no defaults in production, see Settings.validate_production().
    jwt_secret: str = "dev-only-jwt-secret-change-me-32-bytes-min"
    qr_secret: str = "dev-only-qr-secret-change-me-32-bytes-min"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 30 * 24 * 3600

    otp_ttl_seconds: int = 300  # codes expire in 5 minutes
    otp_max_attempts: int = 5
    otp_send_limit: int = 3  # sends per identifier per window
    otp_send_window_seconds: int = 600

    # Platform fee in basis points (800 = 8%). Copied to each organizer at creation.
    default_platform_fee_bps: int = 800
    booking_hold_minutes: int = 15  # unpaid pending bookings expire after this
    refund_cutoff_hours: int = 24  # attendee refunds allowed this long before start

    # Payments
    khalti_base_url: str = "https://dev.khalti.com/api/v2"
    khalti_secret_key: str = ""
    esewa_form_url: str = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
    esewa_status_url: str = "https://rc.esewa.com.np/api/epay/transaction/status/"
    esewa_product_code: str = "EPAYTEST"
    esewa_secret_key: str = "8gBm/:&EnhH.1/q"  # public eSewa sandbox key

    # Image storage: "s3" (S3, Cloudflare R2, MinIO) or "local" (dev only)
    storage_backend: str = "local"
    local_upload_dir: str = "./uploads"
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""  # e.g. https://cdn.zoure.app

    # Messaging. "console" logs messages; swap in a real provider in services/messaging.py
    sms_backend: str = "console"
    email_backend: str = "console"

    def validate_production(self) -> None:
        if self.environment != "production":
            return
        weak = [
            name
            for name in ("jwt_secret", "qr_secret")
            if getattr(self, name).startswith("dev-only")
        ]
        if weak:
            raise RuntimeError(f"Set real secrets for: {', '.join(weak)}")


@lru_cache
def get_settings() -> Settings:
    return Settings()
