from datetime import datetime
from pydantic import BaseModel


class MoodPoint(BaseModel):
    date: str
    average_mood: float
    entries_count: int


class JournalAnalyticsSummary(BaseModel):
    total_entries: int
    average_mood: float | None = None
    min_mood: int | None = None
    max_mood: int | None = None


class JournalRecentEntry(BaseModel):
    id: int
    title: str
    mood_score: int
    is_private: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class JournalStreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_active_days: int


class JournalAnalyticsResponse(BaseModel):
    summary: JournalAnalyticsSummary
    mood_history: list[MoodPoint]