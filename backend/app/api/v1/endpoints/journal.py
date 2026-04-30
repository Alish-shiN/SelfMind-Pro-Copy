from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.journal import JournalCreate, JournalResponse, JournalUpdate
from app.services.journal_service import JournalService

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("/", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JournalService(db).create_entry(current_user, payload)


@router.get("/", response_model=list[JournalResponse])
def get_my_journal_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JournalService(db).get_my_entries(current_user)


@router.get("/{entry_id}", response_model=JournalResponse)
def get_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JournalService(db).get_my_entry(current_user, entry_id)


@router.put("/{entry_id}", response_model=JournalResponse)
def update_journal_entry(
    entry_id: int,
    payload: JournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JournalService(db).update_entry(current_user, entry_id, payload)


@router.delete("/{entry_id}")
def delete_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return JournalService(db).delete_entry(current_user, entry_id)