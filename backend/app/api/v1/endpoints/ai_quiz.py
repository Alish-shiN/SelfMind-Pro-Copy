from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.ai_quiz import (
    AIQuizDetailResponse,
    AIQuizGenerateRequest,
    AIQuizResultResponse,
)
from app.services.ai_quiz_service import AIQuizService
from app.schemas.ai_quiz import AIQuizSubmitRequest

router = APIRouter(prefix="/ai-quiz", tags=["ai-quiz"])


@router.post("/generate", response_model=dict, status_code=status.HTTP_201_CREATED)
def generate_ai_quiz(
    payload: AIQuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = AIQuizService(db).generate_quiz(current_user, payload)
    return {
        "id": session.id,
        "quiz_type": session.quiz_type,
        "status": session.status,
        "generated_questions": session.generated_questions,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.get("/{session_id}", response_model=AIQuizDetailResponse)
def get_ai_quiz_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIQuizService(db).get_session(current_user, session_id)



@router.post("/{session_id}/submit", response_model=AIQuizResultResponse)
def submit_ai_quiz(
    session_id: int,
    payload: AIQuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AIQuizService(db).submit_quiz(current_user, session_id, payload)