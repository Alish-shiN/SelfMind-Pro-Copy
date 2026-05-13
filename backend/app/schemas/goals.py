from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

GoalType = Literal["reflection", "mood_tracking", "self_care", "custom"]
GoalPeriod = Literal["daily", "weekly"]


class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    goal_type: GoalType
    target_count: int = Field(default=1, ge=1, le=100)
    period: GoalPeriod = "weekly"
    template_key: str | None = Field(default=None, max_length=60)


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    target_count: int | None = Field(default=None, ge=1, le=100)
    period: GoalPeriod | None = None
    is_active: bool | None = None


class GoalResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    goal_type: GoalType
    target_count: int
    period: GoalPeriod
    template_key: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalCompletionCreate(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class GoalTemplate(BaseModel):
    key: str
    title: str
    description: str
    goal_type: GoalType = "self_care"
    target_count: int = 1
    period: GoalPeriod = "weekly"


class GoalProgressResponse(BaseModel):
    goal: GoalResponse
    current_count: int
    target_count: int
    progress_percentage: float
    is_completed: bool
    period_start: str
    period_end: str
    message: str


class WeeklyGoalSummaryResponse(BaseModel):
    period_start: str
    period_end: str
    active_goals: int
    completed_goals: int
    partially_completed_goals: int
    missed_goals: int
    overall_completion_percentage: float
    supportive_message: str
    goals: list[GoalProgressResponse]
