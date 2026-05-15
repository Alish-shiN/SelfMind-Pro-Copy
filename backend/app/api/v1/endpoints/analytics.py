from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import (
    JournalAnalyticsResponse,
    MoodAnalyticsResponse,
    JournalRecentEntry,
    JournalStreakResponse,
)
from app.schemas.personalization import AIPersonalizationInsightsResponse
from app.services.analytics_service import AnalyticsService
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    user_cache_key,
)
from app.services.personalization_service import PersonalizationService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/journal", response_model=JournalAnalyticsResponse)
def get_journal_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.ANALYTICS, current_user.id, "journal")
    return cache_get_or_set(
        key,
        CacheTTL.MOOD_ANALYTICS,
        lambda: AnalyticsService(db).get_journal_analytics(current_user),
        response_model=JournalAnalyticsResponse,
    )


@router.get("/mood", response_model=MoodAnalyticsResponse)
def get_mood_analytics(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|6m|1y|custom)$"),
    granularity: str = Query(default="day", pattern="^(day|week|month)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(
        CacheNamespace.MOOD,
        current_user.id,
        {
            "period": period,
            "granularity": granularity,
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    return cache_get_or_set(
        key,
        CacheTTL.MOOD_ANALYTICS,
        lambda: AnalyticsService(db).get_mood_analytics(
            current_user=current_user,
            period=period,
            granularity=granularity,
            start_date=start_date,
            end_date=end_date,
        ),
        response_model=MoodAnalyticsResponse,
    )


@router.get("/journal/recent", response_model=list[JournalRecentEntry])
def get_recent_journal_entries(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(
        CacheNamespace.JOURNAL, current_user.id, "recent", {"limit": limit}
    )
    return cache_get_or_set(
        key,
        CacheTTL.ARCHIVE_SEARCH,
        lambda: AnalyticsService(db).get_recent_entries(current_user, limit),
        response_model=list[JournalRecentEntry],
    )


@router.get("/journal/streak", response_model=JournalStreakResponse)
def get_journal_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.JOURNAL, current_user.id, "streak")
    return cache_get_or_set(
        key,
        CacheTTL.MOOD_ANALYTICS,
        lambda: AnalyticsService(db).get_streak(current_user),
        response_model=JournalStreakResponse,
    )


@router.get("/ai-insights", response_model=AIPersonalizationInsightsResponse)
def get_ai_personalization_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.INSIGHTS, current_user.id, "ai-personalization")
    return cache_get_or_set(
        key,
        CacheTTL.MOOD_ANALYTICS,
        lambda: PersonalizationService(db).get_ai_insights(current_user),
        response_model=AIPersonalizationInsightsResponse,
    )
