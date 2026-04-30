from datetime import datetime
from datetime import date as DateType

from pydantic import BaseModel, EmailStr


class DashboardUser(BaseModel):
    id: int
    username: str
    email: EmailStr


class DashboardStats(BaseModel):
    total_entries: int
    average_mood: float | None = None
    current_streak: int
    longest_streak: int


class DashboardRecentEntry(BaseModel):
    id: int
    title: str
    mood_score: int
    is_private: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class DashboardLatestAnalysis(BaseModel):
    journal_entry_id: int
    sentiment_label: str
    emotion_label: str
    confidence_score: float
    short_summary: str
    recommendation: str


class DashboardHomeResponse(BaseModel):
    user: DashboardUser
    stats: DashboardStats
    recent_entries: list[DashboardRecentEntry]
    latest_analysis: DashboardLatestAnalysis | None = None
    # Dates (YYYY-MM-DD) where the user has at least one journal entry.
    active_dates: list[DateType] = []