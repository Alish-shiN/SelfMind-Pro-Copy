from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

PreferredReflectionFormat = Literal["diary", "chat", "quiz"]
ReminderFrequency = Literal["daily", "few_times_week", "weekly", "none"]
AITone = Literal["calm", "practical", "motivating", "reflective"]
CommunityProfileVisibility = Literal["anonymous", "members", "public"]


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PrivacyPreferences(BaseModel):
    journal_private_default: bool = True
    anonymous_community_default: bool = False
    share_ai_insights: bool = False
    community_profile_visibility: CommunityProfileVisibility = "members"
    ai_processing_consent: bool = False
    privacy_notice_accepted: bool = False
    privacy_notice_version: str | None = None
    privacy_notice_accepted_at: str | None = None


class UserPreferencesResponse(BaseModel):
    emotional_goals: list[str] = []
    preferred_reflection_format: PreferredReflectionFormat = "diary"
    reminder_frequency: ReminderFrequency = "none"
    privacy_preferences: PrivacyPreferences = Field(default_factory=PrivacyPreferences)
    ai_tone: AITone = "calm"
    onboarding_completed: bool = False
    onboarding_skipped: bool = False


class UserPreferencesUpdate(BaseModel):
    emotional_goals: list[str] | None = Field(default=None, max_length=8)
    preferred_reflection_format: PreferredReflectionFormat | None = None
    reminder_frequency: ReminderFrequency | None = None
    privacy_preferences: PrivacyPreferences | None = None
    ai_tone: AITone | None = None
    onboarding_completed: bool | None = None
    onboarding_skipped: bool | None = None


class PrivacyCenterResponse(BaseModel):
    notice_version: str
    notice: dict[str, Any]
    preferences: UserPreferencesResponse
    export_options: list[dict[str, Any]] = Field(default_factory=list)
