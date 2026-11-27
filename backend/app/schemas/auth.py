import uuid
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import UserRole
from app.utils import normalize_phone


class OtpRequest(BaseModel):
    channel: Literal["phone", "email"]
    identifier: str = Field(min_length=5, max_length=254, description="Nepali mobile (98XXXXXXXX) or email")

    @model_validator(mode="after")
    def normalize(self):
        try:
            if self.channel == "phone":
                self.identifier = normalize_phone(self.identifier)
            else:
                self.identifier = validate_email(self.identifier, check_deliverability=False).normalized.lower()
        except (ValueError, EmailNotValidError) as e:
            raise ValueError(
                "Enter a Nepali mobile number like 98XXXXXXXX" if self.channel == "phone" else "Enter a valid email address"
            ) from e
        return self


class OtpVerify(OtpRequest):
    code: str = Field(pattern=r"^\d{6}$", description="6-digit code")
    name: str | None = Field(default=None, max_length=120)


class OtpSent(BaseModel):
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str | None
    email: str | None
    name: str | None
    role: UserRole
    organizer_id: uuid.UUID | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class AuthResponse(TokenPair):
    user: UserOut
