from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SafetySourceType = Literal["journal_entry", "chat_message", "community_post", "community_comment", "ai_quiz_answer", "manual_check"]
SafetySeverity = Literal["low", "medium", "high", "crisis"]


class SafetyFlagResponse(BaseModel):
    id: int
    user_id: int | None
    source_type: str
    source_id: int | None
    severity: str
    status: str
    matched_signals: list[str]
    content_excerpt: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SafetyCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    source_type: SafetySourceType = "manual_check"


class SafetyCheckResponse(BaseModel):
    is_flagged: bool
    severity: SafetySeverity | None
    matched_signals: list[str]
    message: str | None


class CrisisResource(BaseModel):
    title: str
    description: str
    action_label: str
    action_value: str
    country: str = "US"
