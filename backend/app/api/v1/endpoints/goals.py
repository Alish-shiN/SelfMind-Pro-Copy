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
from app.services.goal_service import GoalService, SELF_CARE_TEMPLATES

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("/templates", response_model=list[GoalTemplate])
def get_goal_templates():
    return [
        {**template, "goal_type": "self_care", "target_count": 1, "period": "weekly"}
        for template in SELF_CARE_TEMPLATES
    ]


@router.get("", response_model=list[GoalResponse])
def list_goals(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).list_goals(current_user, include_inactive)


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).create_goal(current_user, payload)


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).update_goal(current_user, goal_id, payload)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    GoalService(db).delete_goal(current_user, goal_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/progress", response_model=list[GoalProgressResponse])
def get_goal_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).progress(current_user)


@router.get("/weekly-summary", response_model=WeeklyGoalSummaryResponse)
def get_weekly_goal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).weekly_summary(current_user)


@router.post("/{goal_id}/complete", response_model=GoalProgressResponse)
def complete_goal(
    goal_id: int,
    payload: GoalCompletionCreate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return GoalService(db).complete_goal(
        current_user, goal_id, payload.note if payload else None
    )
