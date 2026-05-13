from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


def _validate_hhmm(value: str | None) -> str | None:
    if value is None:
        return value
    parts = value.split(":")
    if len(parts) != 2:
        raise ValueError("Time must be in HH:MM format")
    hour, minute = parts
    if not (hour.isdigit() and minute.isdigit()):
        raise ValueError("Time must be in HH:MM format")
    hour_int = int(hour)
    minute_int = int(minute)
    if hour_int < 0 or hour_int > 23 or minute_int < 0 or minute_int > 59:
        raise ValueError("Time must be a valid 24-hour HH:MM value")
    return f"{hour_int:02d}:{minute_int:02d}"


class JournalBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    mood_score: int = Field(ge=1, le=10)
    # Allows client to set which day the entry belongs to (used by calendar).
    # Expected format: "YYYY-MM-DD"
    entry_date: date | None = None
    tags: list[str] | None = []
    is_private: bool = True
    push_notification_enabled: bool = False
    notification_title: str | None = Field(default=None, max_length=200)
    notification_time: str | None = None

    @field_validator("notification_time")
    @classmethod
    def validate_notification_time(cls, value: str | None) -> str | None:
        return _validate_hhmm(value)


class JournalCreate(JournalBase):
    language: str = Field(default="en", pattern="^(en|ru|kk)$")


class JournalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    mood_score: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    is_private: bool | None = None
    push_notification_enabled: bool | None = None
    notification_title: str | None = Field(default=None, max_length=200)
    notification_time: str | None = None

    @field_validator("notification_time")
    @classmethod
    def validate_notification_time(cls, value: str | None) -> str | None:
        return _validate_hhmm(value)


class JournalResponse(BaseModel):
    id: int
    user_id: int
    title: str
    content: str
    mood_score: int
    tags: list[str] | None = None
    is_private: bool
    push_notification_enabled: bool
    notification_title: str | None
    notification_time: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
