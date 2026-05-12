from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.reminder_preference import ReminderPreference
from app.models.user import User
from app.schemas.reminders import PushTokenUpdate, ReminderPreferenceUpdate

REMINDER_COPY = {
    "journal": {
        "title": "Daily reflection",
        "message": "How are you feeling today? Take a minute to write it down.",
    },
    "mood_checkin": {
        "title": "Mood check-in",
        "message": "Pause and notice your mood before the day gets busy.",
    },
    "ai_quiz": {
        "title": "AI self-check",
        "message": "Would you like to reflect with a short AI self-check today?",
    },
}


class ReminderService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_preferences(self, current_user: User) -> ReminderPreference:
        preference = (
            self.db.query(ReminderPreference)
            .filter(ReminderPreference.user_id == current_user.id)
            .first()
        )
        if preference:
            return preference

        preference = ReminderPreference(user_id=current_user.id)
        self.db.add(preference)
        self.db.commit()
        self.db.refresh(preference)
        return preference

    def update_preferences(
        self,
        current_user: User,
        payload: ReminderPreferenceUpdate,
    ) -> ReminderPreference:
        preference = self.get_or_create_preferences(current_user)
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(preference, field, value)
        self.db.commit()
        self.db.refresh(preference)
        return preference

    def register_push_token(self, current_user: User, payload: PushTokenUpdate) -> ReminderPreference:
        preference = self.get_or_create_preferences(current_user)
        preference.push_token = payload.push_token
        preference.push_platform = payload.push_platform
        self.db.commit()
        self.db.refresh(preference)
        return preference

    def get_due_reminders(self, current_user: User, current_time: str | None = None) -> list[dict]:
        preference = self.get_or_create_preferences(current_user)
        if not preference.reminders_enabled:
            return []

        now_time = current_time or self._current_hhmm(preference.timezone)
        due_reminders: list[dict] = []
        reminder_flags = [
            ("journal", preference.journal_enabled, preference.journal_time),
            ("mood_checkin", preference.mood_checkin_enabled, preference.mood_checkin_time),
            ("ai_quiz", preference.ai_quiz_enabled, preference.ai_quiz_time),
        ]
        for reminder_type, enabled, scheduled_time in reminder_flags:
            if enabled and scheduled_time == now_time:
                copy = REMINDER_COPY[reminder_type]
                due_reminders.append({
                    "type": reminder_type,
                    "title": copy["title"],
                    "message": copy["message"],
                    "scheduled_time": scheduled_time,
                })
        return due_reminders

    def _current_hhmm(self, timezone_name: str) -> str:
        try:
            tz = ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reminder timezone",
            )
        return datetime.now(tz).strftime("%H:%M")
