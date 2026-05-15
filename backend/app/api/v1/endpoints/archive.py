from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.journal import JournalEntry
from app.models.journal_analysis import JournalAnalysis
from app.models.user import User
from app.schemas.archive import ArchiveSearchResult
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    user_cache_key,
)

router = APIRouter(prefix="/archive", tags=["archive"])


def _preview(value: str, max_length: int = 180) -> str:
    normalized = " ".join((value or "").split())
    if len(normalized) <= max_length:
        return normalized
    return f"{normalized[: max_length - 1].rstrip()}…"


@router.get("/search", response_model=list[ArchiveSearchResult])
def search_archive(
    q: str | None = Query(default=None, max_length=200),
    tab: str = Query(default="journals", pattern="^(journals|insights|favorites)$"),
    start_date: date | None = None,
    end_date: date | None = None,
    mood_or_emotion: str | None = Query(default=None, max_length=80),
    tags: list[str] = Query(default=[]),
    favorites_only: bool = False,
    favorite_ids: list[int] = Query(default=[]),
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = {
        "q": q,
        "tab": tab,
        "start_date": start_date,
        "end_date": end_date,
        "mood_or_emotion": mood_or_emotion,
        "tags": sorted(tags),
        "favorites_only": favorites_only,
        "favorite_ids": sorted(favorite_ids),
        "sort": sort,
        "limit": limit,
    }
    key = user_cache_key(CacheNamespace.ARCHIVE, current_user.id, "search", filters)
    return cache_get_or_set(
        key,
        CacheTTL.ARCHIVE_SEARCH,
        lambda: _search_archive_uncached(
            db=db,
            current_user=current_user,
            q=q,
            tab=tab,
            start_date=start_date,
            end_date=end_date,
            mood_or_emotion=mood_or_emotion,
            tags=tags,
            favorites_only=favorites_only,
            favorite_ids=favorite_ids,
            sort=sort,
            limit=limit,
        ),
        response_model=list[ArchiveSearchResult],
    )


def _search_archive_uncached(
    *,
    db: Session,
    current_user: User,
    q: str | None,
    tab: str,
    start_date: date | None,
    end_date: date | None,
    mood_or_emotion: str | None,
    tags: list[str],
    favorites_only: bool,
    favorite_ids: list[int],
    sort: str,
    limit: int,
):
    favorite_id_set = set(favorite_ids)
    if favorites_only and not favorite_id_set:
        return []

    query = (
        db.query(JournalEntry, JournalAnalysis)
        .outerjoin(JournalAnalysis, JournalAnalysis.journal_entry_id == JournalEntry.id)
        .filter(JournalEntry.user_id == current_user.id)
    )

    if tab == "insights":
        query = query.filter(JournalAnalysis.id.isnot(None))
    if tab == "favorites" or favorites_only:
        query = query.filter(JournalEntry.id.in_(favorite_id_set))

    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                JournalEntry.title.ilike(pattern),
                JournalEntry.content.ilike(pattern),
                cast(JournalEntry.tags, String).ilike(pattern),
                JournalAnalysis.short_summary.ilike(pattern),
                JournalAnalysis.recommendation.ilike(pattern),
                JournalAnalysis.emotion_label.ilike(pattern),
                JournalAnalysis.sentiment_label.ilike(pattern),
            )
        )

    if start_date:
        query = query.filter(
            JournalEntry.created_at >= datetime.combine(start_date, time.min)
        )
    if end_date:
        query = query.filter(
            JournalEntry.created_at <= datetime.combine(end_date, time.max)
        )

    if mood_or_emotion and mood_or_emotion.strip():
        mood_value = mood_or_emotion.strip()
        if mood_value.isdigit():
            query = query.filter(JournalEntry.mood_score == int(mood_value))
        else:
            pattern = f"%{mood_value}%"
            query = query.filter(
                or_(
                    JournalAnalysis.emotion_label.ilike(pattern),
                    JournalAnalysis.sentiment_label.ilike(pattern),
                )
            )

    for tag in [item.strip() for item in tags if item.strip()]:
        query = query.filter(cast(JournalEntry.tags, String).ilike(f"%{tag}%"))

    order_by = (
        JournalEntry.created_at.asc()
        if sort == "oldest"
        else JournalEntry.created_at.desc()
    )
    rows = query.order_by(order_by).limit(limit).all()

    return [
        {
            "id": entry.id,
            "result_type": "insight" if analysis else "journal",
            "title": entry.title,
            "content_preview": _preview(entry.content),
            "mood_score": entry.mood_score,
            "tags": entry.tags,
            "is_private": entry.is_private,
            "is_favorite": entry.id in favorite_id_set,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "sentiment_label": analysis.sentiment_label if analysis else None,
            "emotion_label": analysis.emotion_label if analysis else None,
            "insight_summary": analysis.short_summary if analysis else None,
            "recommendation": analysis.recommendation if analysis else None,
        }
        for entry, analysis in rows
    ]
