from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.journal import JournalCreate, JournalResponse, JournalUpdate
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    invalidate_user_cache,
    user_cache_key,
)
from app.services.journal_service import JournalService

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = JournalService(db).create_entry(current_user, payload)
    _invalidate_journal_caches(current_user.id)
    return entry


@router.get("/", response_model=list[JournalResponse])
def get_my_journal_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.JOURNAL, current_user.id, "entries")
    return cache_get_or_set(
        key,
        CacheTTL.ARCHIVE_SEARCH,
        lambda: JournalService(db).get_my_entries(current_user),
        response_model=list[JournalResponse],
    )


@router.get("/{entry_id}", response_model=JournalResponse)
def get_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.JOURNAL, current_user.id, "entry", entry_id)
    return cache_get_or_set(
        key,
        CacheTTL.ARCHIVE_SEARCH,
        lambda: JournalService(db).get_my_entry(current_user, entry_id),
        response_model=JournalResponse,
    )


@router.put("/{entry_id}", response_model=JournalResponse)
def update_journal_entry(
    entry_id: int,
    payload: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = JournalService(db).update_entry(current_user, entry_id, payload)
    _invalidate_journal_caches(current_user.id)
    return entry


@router.delete("/{entry_id}")
def delete_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = JournalService(db).delete_entry(current_user, entry_id)
    _invalidate_journal_caches(current_user.id)
    return result


def _invalidate_journal_caches(user_id: int) -> None:
    invalidate_user_cache(
        user_id,
        CacheNamespace.JOURNAL,
        CacheNamespace.DASHBOARD,
        CacheNamespace.MOOD,
        CacheNamespace.ANALYTICS,
        CacheNamespace.ARCHIVE,
        CacheNamespace.INSIGHTS,
    )
