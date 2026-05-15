from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.goals import (
    GoalCompletionCreate,
    GoalCreate,
    GoalProgressResponse,
    GoalResponse,
    GoalTemplate,
    GoalUpdate,
    WeeklyGoalSummaryResponse,
)
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    cache_key,
    invalidate_user_cache,
    user_cache_key,
)
from app.services.goal_service import GoalService, SELF_CARE_TEMPLATES

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("/templates", response_model=list[GoalTemplate])
def get_goal_templates():
    key = cache_key(CacheNamespace.GOALS, "templates")
    return cache_get_or_set(
        key,
        CacheTTL.STATIC,
        lambda: [
            {
                **template,
                "goal_type": "self_care",
                "target_count": 1,
                "period": "weekly",
            }
            for template in SELF_CARE_TEMPLATES
        ],
        response_model=list[GoalTemplate],
    )


@router.get("", response_model=list[GoalResponse])
def list_goals(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(
        CacheNamespace.GOALS,
        current_user.id,
        "list",
        {"include_inactive": include_inactive},
    )
    return cache_get_or_set(
        key,
        CacheTTL.GOALS,
        lambda: GoalService(db).list_goals(current_user, include_inactive),
        response_model=list[GoalResponse],
    )


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = GoalService(db).create_goal(current_user, payload)
    _invalidate_goal_caches(current_user.id)
    return goal


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = GoalService(db).update_goal(current_user, goal_id, payload)
    _invalidate_goal_caches(current_user.id)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    GoalService(db).delete_goal(current_user, goal_id)
    _invalidate_goal_caches(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/progress", response_model=list[GoalProgressResponse])
def get_goal_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.GOALS, current_user.id, "progress")
    return cache_get_or_set(
        key,
        CacheTTL.GOALS,
        lambda: GoalService(db).progress(current_user),
        response_model=list[GoalProgressResponse],
    )


@router.get("/weekly-summary", response_model=WeeklyGoalSummaryResponse)
def get_weekly_goal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.GOALS, current_user.id, "weekly-summary")
    return cache_get_or_set(
        key,
        CacheTTL.GOALS,
        lambda: GoalService(db).weekly_summary(current_user),
        response_model=WeeklyGoalSummaryResponse,
    )


@router.post("/{goal_id}/complete", response_model=GoalProgressResponse)
def complete_goal(
    goal_id: int,
    payload: GoalCompletionCreate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progress = GoalService(db).complete_goal(
        current_user, goal_id, payload.note if payload else None
    )
    _invalidate_goal_caches(current_user.id)
    return progress


def _invalidate_goal_caches(user_id: int) -> None:
    invalidate_user_cache(
        user_id,
        CacheNamespace.GOALS,
        CacheNamespace.DASHBOARD,
    )
