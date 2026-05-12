from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ReminderFrequency = Literal["daily", "weekdays", "weekly"]
PushPlatform = Literal["ios", "android", "expo", "web"]


def _validate_hhmm(value: str) -> str:
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


class ReminderPreferenceResponse(BaseModel):
    id: int
    user_id: int
    reminders_enabled: bool
    journal_enabled: bool
    mood_checkin_enabled: bool
    ai_quiz_enabled: bool
    journal_time: str
    mood_checkin_time: str
    ai_quiz_time: str
    frequency: str
    timezone: str
    push_token: str | None
    push_platform: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReminderPreferenceUpdate(BaseModel):
    reminders_enabled: bool | None = None
    journal_enabled: bool | None = None
    mood_checkin_enabled: bool | None = None
    ai_quiz_enabled: bool | None = None
    journal_time: str | None = None
    mood_checkin_time: str | None = None
    ai_quiz_time: str | None = None
    frequency: ReminderFrequency | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=80)

    @field_validator("journal_time", "mood_checkin_time", "ai_quiz_time")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_hhmm(value)


class PushTokenUpdate(BaseModel):
    push_token: str = Field(min_length=1, max_length=4096)
    push_platform: PushPlatform


class DueReminder(BaseModel):
    type: Literal["journal", "mood_checkin", "ai_quiz"]
    title: str
    message: str
    scheduled_time: str
