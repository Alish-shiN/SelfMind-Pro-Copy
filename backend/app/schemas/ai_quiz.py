from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AIQuizQuestion(BaseModel):
    question_index: int
    question_text: str
    answer_type: str
    options: list[str] | None = None


class AIQuizGenerateRequest(BaseModel):
    quiz_type: str = "stress"
    language: str = "en"


class AIQuizSessionResponse(BaseModel):
    id: int
    quiz_type: str
    status: str
    generated_questions: list[AIQuizQuestion]
    created_at: datetime
    updated_at: datetime


class AIQuizAnswerItem(BaseModel):
    question_index: int
    question_text: str
    answer_text: str
    score: int | None = Field(default=None, ge=0, le=4)


class AIQuizSubmitRequest(BaseModel):
    answers: list[AIQuizAnswerItem]
    language: str = "en"


class AIQuizMicroPractice(BaseModel):
    title: str
    description: str
    estimated_time: str
    action: Literal["journal", "mood", "goals"] | None = None


class AIQuizActionPlan(BaseModel):
    quiz_type: str
    result_level: str
    steps: list[str]
    micro_practices: list[AIQuizMicroPractice]
    reflection_prompt: str
    suggested_goal: str | None = None
    supportive_message: str


class AIQuizTrend(BaseModel):
    trend_direction: Literal["improved", "worsened", "stable", "first_time"]
    previous_score: float | None = None
    current_score: float
    score_difference: float | None = None
    explanation: str


class AIQuizResultResponse(BaseModel):
    id: int
    session_id: int
    quiz_type: str | None = None
    overall_score: float
    severity_level: str
    insight: str
    recommendation: str
    practice: str
    recommendations: list[str] | None = None
    micro_practices: list[AIQuizMicroPractice] | None = None
    action_plan: AIQuizActionPlan | None = None
    trend_direction: str | None = None
    previous_score: float | None = None
    score_difference: float | None = None
    trend_explanation: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIQuizDetailResponse(BaseModel):
    session: AIQuizSessionResponse
    result: AIQuizResultResponse | None = None


class AIQuizTypeResponse(BaseModel):
    key: str
    title: str
    description: str
    estimated_minutes: int
    emoji: str | None = None
    status: Literal["not_started", "completed", "completed_recently"]
    latest_result_id: int | None = None
    latest_score: float | None = None
    latest_level: str | None = None
    latest_completed_at: datetime | None = None


class AIQuizHistoryItem(BaseModel):
    result_id: int
    session_id: int
    quiz_type: str
    quiz_title: str
    completed_at: datetime
    score: float
    severity_level: str
    summary: str
    has_recommendations: bool
    has_action_plan: bool
    trend_direction: str | None = None
    previous_score: float | None = None
    score_difference: float | None = None


class AIQuizLatestActionPlanResponse(BaseModel):
    result_id: int
    session_id: int
    quiz_type: str
    quiz_title: str
    created_at: datetime
    score: float
    severity_level: str
    summary: str
    next_actions: list[str]
    action_plan: AIQuizActionPlan
