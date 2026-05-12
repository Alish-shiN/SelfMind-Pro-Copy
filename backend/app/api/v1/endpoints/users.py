from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])

DEFAULT_PRIVACY = {
    "journal_private_default": True,
    "anonymous_community_default": False,
    "share_ai_insights": False,
}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_my_preferences(current_user: User = Depends(get_current_user)):
    return _serialize_preferences(current_user)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
def update_my_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if field == "emotional_goals":
                value = _normalize_goals(value)
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return _serialize_preferences(current_user)


def _serialize_preferences(user: User) -> dict:
    privacy = {**DEFAULT_PRIVACY, **(user.privacy_preferences or {})}
    return {
        "emotional_goals": user.emotional_goals or [],
        "preferred_reflection_format": user.preferred_reflection_format or "diary",
        "reminder_frequency": user.reminder_frequency or "none",
        "privacy_preferences": privacy,
        "ai_tone": user.ai_tone or "calm",
        "onboarding_completed": bool(user.onboarding_completed),
        "onboarding_skipped": bool(user.onboarding_skipped),
    }


def _normalize_goals(goals: list[str]) -> list[str]:
    normalized = []
    for goal in goals:
        value = goal.strip().lower()[:60]
        if value and value not in normalized:
            normalized.append(value)
    return normalized[:8]
