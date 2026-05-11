from datetime import date, datetime

from pydantic import BaseModel, Field


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


class JournalCreate(JournalBase):
    pass


class JournalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    mood_score: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    is_private: bool | None = None
    push_notification_enabled: bool | None = None
    notification_title: str | None = Field(default=None, max_length=200)


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
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }   