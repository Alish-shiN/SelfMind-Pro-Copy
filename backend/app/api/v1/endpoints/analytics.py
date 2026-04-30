from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import (
    JournalAnalyticsResponse,
    JournalRecentEntry,
    JournalStreakResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/journal", response_model=JournalAnalyticsResponse)
def get_journal_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService(db).get_journal_analytics(current_user)


@router.get("/journal/recent", response_model=list[JournalRecentEntry])
def get_recent_journal_entries(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService(db).get_recent_entries(current_user, limit)


@router.get("/journal/streak", response_model=JournalStreakResponse)
def get_journal_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService(db).get_streak(current_user)