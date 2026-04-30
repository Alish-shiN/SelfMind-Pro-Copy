from datetime import datetime
from pydantic import BaseModel, Field


class AIQuizQuestion(BaseModel):
    question_index: int
    question_text: str
    answer_type: str
    options: list[str] | None = None


class AIQuizGenerateRequest(BaseModel):
    quiz_type: str = "stress_reflection"


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


class AIQuizResultResponse(BaseModel):
    id: int
    session_id: int
    overall_score: float
    severity_level: str
    insight: str
    recommendation: str
    practice: str
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class AIQuizDetailResponse(BaseModel):
    session: AIQuizSessionResponse
    result: AIQuizResultResponse | None = None