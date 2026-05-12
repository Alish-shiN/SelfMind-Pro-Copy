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

    model_config = {"from_attributes": True}


class JournalStreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_active_days: int


class JournalAnalyticsResponse(BaseModel):
    summary: JournalAnalyticsSummary
    mood_history: list[MoodPoint]


class MoodAnalyticsPoint(BaseModel):
    period_start: str
    period_end: str
    label: str
    average_mood: float | None = None
    entries_count: int


class TopEmotionPoint(BaseModel):
    emotion_label: str
    count: int
    percentage: float


class JournalingFrequency(BaseModel):
    total_days: int
    active_days: int
    entries_count: int
    entries_per_week: float
    average_entries_per_active_day: float
    consistency_percentage: float


class StreakCalendarDay(BaseModel):
    date: str
    has_entry: bool
    entries_count: int
    average_mood: float | None = None
    streak_day: int


class CorrelationMetric(BaseModel):
    metric: str
    coefficient: float | None = None
    strength: str
    interpretation: str


class EmotionHeatmapDay(BaseModel):
    date: str
    dominant_emotion: str | None = None
    entries_count: int
    average_mood: float | None = None
    intensity: float


class MoodAnalyticsInsight(BaseModel):
    title: str
    description: str


class MoodAnalyticsResponse(BaseModel):
    period: str
    granularity: str
    start_date: str
    end_date: str
    summary: JournalAnalyticsSummary
    mood_history: list[MoodAnalyticsPoint]
    top_emotions: list[TopEmotionPoint]
    journaling_frequency: JournalingFrequency
    streak: JournalStreakResponse
    streak_calendar: list[StreakCalendarDay]
    correlations: list[CorrelationMetric]
    emotion_heatmap: list[EmotionHeatmapDay]
    insights: list[MoodAnalyticsInsight]
