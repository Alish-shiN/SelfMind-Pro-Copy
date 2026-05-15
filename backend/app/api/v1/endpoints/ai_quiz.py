from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.ai_quiz import (
    AIQuizDetailResponse,
    AIQuizGenerateRequest,
    AIQuizHistoryItem,
    AIQuizLatestActionPlanResponse,
    AIQuizResultResponse,
    AIQuizSubmitRequest,
    AIQuizTypeResponse,
)
from app.services.ai_quiz_service import AIQuizService
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    invalidate_user_cache,
    user_cache_key,
)

router = APIRouter(prefix="/ai-quiz", tags=["ai-quiz"])


@router.get("/types", response_model=list[AIQuizTypeResponse])
def get_ai_quiz_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.QUIZ, current_user.id, "types")
    return cache_get_or_set(
        key,
        CacheTTL.STATIC,
        lambda: AIQuizService(db).get_quiz_types(current_user),
        response_model=list[AIQuizTypeResponse],
    )


@router.post("/generate", response_model=dict, status_code=status.HTTP_201_CREATED)
def generate_ai_quiz(
    payload: AIQuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = AIQuizService(db).generate_quiz(current_user, payload)
    _invalidate_quiz_caches(current_user.id)
    return {
        "id": session.id,
        "quiz_type": session.quiz_type,
        "status": session.status,
        "generated_questions": session.generated_questions,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.get("/history", response_model=list[AIQuizHistoryItem])
def get_ai_quiz_history(
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(
        CacheNamespace.QUIZ, current_user.id, "history", {"limit": limit}
    )
    return cache_get_or_set(
        key,
        CacheTTL.QUIZ,
        lambda: AIQuizService(db).list_history(current_user, limit=limit),
        response_model=list[AIQuizHistoryItem],
    )


@router.get("/history/{result_id}", response_model=AIQuizResultResponse)
def get_ai_quiz_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.QUIZ, current_user.id, "result", result_id)
    return cache_get_or_set(
        key,
        CacheTTL.QUIZ,
        lambda: AIQuizService(db).get_result(current_user, result_id),
        response_model=AIQuizResultResponse,
    )


@router.get("/latest-action-plan", response_model=AIQuizLatestActionPlanResponse | None)
def get_latest_ai_quiz_action_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.QUIZ, current_user.id, "latest-action-plan")
    return cache_get_or_set(
        key,
        CacheTTL.QUIZ,
        lambda: AIQuizService(db).get_latest_action_plan(current_user),
        response_model=AIQuizLatestActionPlanResponse | None,
    )


@router.post(
    "/results/{result_id}/save-action-plan",
    response_model=AIQuizLatestActionPlanResponse,
)
def save_ai_quiz_action_plan(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action_plan = AIQuizService(db).save_action_plan(current_user, result_id)
    _invalidate_quiz_caches(current_user.id)
    return action_plan


@router.get("/{session_id}", response_model=AIQuizDetailResponse)
def get_ai_quiz_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.QUIZ, current_user.id, "session", session_id)
    return cache_get_or_set(
        key,
        CacheTTL.QUIZ,
        lambda: AIQuizService(db).get_session(current_user, session_id),
        response_model=AIQuizDetailResponse,
    )


@router.post("/{session_id}/submit", response_model=AIQuizResultResponse)
def submit_ai_quiz(
    session_id: int,
    payload: AIQuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = AIQuizService(db).submit_quiz(current_user, session_id, payload)
    _invalidate_quiz_caches(current_user.id)
    return result


def _invalidate_quiz_caches(user_id: int) -> None:
    invalidate_user_cache(
        user_id,
        CacheNamespace.QUIZ,
        CacheNamespace.DASHBOARD,
        CacheNamespace.ANALYTICS,
        CacheNamespace.INSIGHTS,
    )
