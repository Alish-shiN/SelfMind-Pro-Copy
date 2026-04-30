from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.analytics_repository import AnalyticsRepository


class AnalyticsService:
    def __init__(self, db: Session):
        self.repo = AnalyticsRepository(db)

    def get_journal_analytics(self, current_user: User):
        summary = self.repo.get_summary(current_user.id)
        mood_history = self.repo.get_mood_history(current_user.id)

        return {
            "summary": summary,
            "mood_history": mood_history,
        }

    def get_recent_entries(self, current_user: User, limit: int = 5):
        return self.repo.get_recent_entries(current_user.id, limit)

    def get_streak(self, current_user: User):
        active_dates = self.repo.get_active_dates(current_user.id)
        return self.repo.calculate_streaks(active_dates)