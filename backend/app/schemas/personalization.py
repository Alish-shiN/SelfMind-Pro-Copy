from datetime import datetime

from pydantic import BaseModel


class WeeklySummary(BaseModel):
    week_start: str
    week_end: str
    entries_count: int
    average_mood: float | None = None
    summary: str


class AIInsightTimelineItem(BaseModel):
    id: int
    journal_entry_id: int
    created_at: datetime
    emotion_label: str
    sentiment_label: str
    title: str
    observation: str
    recommendation: str


class AIPersonalizationInsightsResponse(BaseModel):
    average_mood: float | None = None
    total_entries: int
    latest_emotion: str | None = None
    weekly_summaries: list[WeeklySummary]
    mood_trends_explanation: str | None = None
    adaptive_prompts: list[str]
    journaling_suggestions: list[str]
    follow_up_questions: list[str]
    pattern_reflections: list[str]
    insights_timeline: list[AIInsightTimelineItem]
