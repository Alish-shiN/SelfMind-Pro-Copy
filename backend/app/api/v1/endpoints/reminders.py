from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.reminders import (
    DueReminder,
    PushTokenUpdate,
    ReminderPreferenceResponse,
    ReminderPreferenceUpdate,
)
from app.services.reminder_service import ReminderService

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("/preferences", response_model=ReminderPreferenceResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).get_or_create_preferences(current_user)


@router.patch("/preferences", response_model=ReminderPreferenceResponse)
def update_preferences(
    payload: ReminderPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).update_preferences(current_user, payload)


@router.post("/push-token", response_model=ReminderPreferenceResponse)
def register_push_token(
    payload: PushTokenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).register_push_token(current_user, payload)


@router.get("/due", response_model=list[DueReminder])
def get_due_reminders(
    current_time: str | None = Query(default=None, pattern=r"^\d{2}:\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReminderService(db).get_due_reminders(current_user, current_time=current_time)
