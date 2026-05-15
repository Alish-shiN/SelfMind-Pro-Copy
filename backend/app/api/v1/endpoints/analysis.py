from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analysis import JournalAnalysisResponse
from app.services.analysis_service import AnalysisService
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    invalidate_user_cache,
    user_cache_key,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/journal/{entry_id}", response_model=JournalAnalysisResponse)
def get_journal_entry_analysis(
    entry_id: int,
    language: str = Query(default="en", pattern="^(en|ru|kk)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(
        CacheNamespace.INSIGHTS, current_user.id, "journal-analysis", entry_id, language
    )
    return cache_get_or_set(
        key,
        CacheTTL.MOOD_ANALYTICS,
        lambda: AnalysisService(db).get_entry_analysis(
            current_user, entry_id, language
        ),
    )


@router.post(
    "/journal/{entry_id}/regenerate",
    response_model=JournalAnalysisResponse,
    status_code=status.HTTP_200_OK,
)
def regenerate_journal_entry_analysis(
    entry_id: int,
    language: str = Query(default="en", pattern="^(en|ru|kk)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = AnalysisService(db).regenerate_for_entry(
        current_user, entry_id, language
    )
    invalidate_user_cache(
        current_user.id,
        CacheNamespace.INSIGHTS,
        CacheNamespace.ARCHIVE,
        CacheNamespace.ANALYTICS,
        CacheNamespace.MOOD,
        CacheNamespace.DASHBOARD,
    )
    return analysis
