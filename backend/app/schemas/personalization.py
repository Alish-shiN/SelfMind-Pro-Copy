from datetime import datetime

from pydantic import BaseModel, Field


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


class PrivacyPreferences(BaseModel):
    journal_private_default: bool = True
    anonymous_community_default: bool = False
    share_ai_insights: bool = False


class PersonalizationUserPreferences(BaseModel):
    emotional_goals: list[str] = []
    preferred_reflection_format: str = "diary"
    reminder_frequency: str = "none"
    privacy_preferences: PrivacyPreferences = Field(default_factory=PrivacyPreferences)
    ai_tone: str = "calm"
    onboarding_completed: bool = False
    onboarding_skipped: bool = False


class MoodAnalyticsPersonalizationContext(BaseModel):
    summary: dict
    recent_mood_history: list[dict]
    streaks: dict
    journaling_frequency_30_entries_window: dict
    top_emotions: list[dict]


class AIPersonalizationInsightsResponse(BaseModel):
    average_mood: float | None = None
    total_entries: int
    latest_emotion: str | None = None
    user_preferences: PersonalizationUserPreferences
    mood_analytics_context: MoodAnalyticsPersonalizationContext
    weekly_summaries: list[WeeklySummary]
    mood_trends_explanation: str | None = None
    adaptive_prompts: list[str]
    journaling_suggestions: list[str]
    follow_up_questions: list[str]
    pattern_reflections: list[str]
    insights_timeline: list[AIInsightTimelineItem]
