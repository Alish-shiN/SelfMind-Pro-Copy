from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.analytics_repository import AnalyticsRepository
from app.repo.dashboard_repository import DashboardRepository


class DashboardService:
    def __init__(self, db: Session):
        self.analytics_repo = AnalyticsRepository(db)
        self.dashboard_repo = DashboardRepository(db)

    def get_home(self, current_user: User):
        summary = self.analytics_repo.get_summary(current_user.id)
        active_dates = self.analytics_repo.get_active_dates(current_user.id)
        streak_data = self.analytics_repo.calculate_streaks(active_dates)
        recent_entries = self.dashboard_repo.get_recent_entries(current_user.id, limit=5)
        latest_analysis = self.dashboard_repo.get_latest_analysis(current_user.id)

        latest_analysis_payload = None
        if latest_analysis:
            latest_analysis_payload = {
                "journal_entry_id": latest_analysis.journal_entry_id,
                "sentiment_label": latest_analysis.sentiment_label,
                "emotion_label": latest_analysis.emotion_label,
                "confidence_score": latest_analysis.confidence_score,
                "short_summary": latest_analysis.short_summary,
                "recommendation": latest_analysis.recommendation,
            }

        return {
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
            },
            "stats": {
                "total_entries": summary["total_entries"],
                "average_mood": summary["average_mood"],
                "current_streak": streak_data["current_streak"],
                "longest_streak": streak_data["longest_streak"],
            },
            "recent_entries": recent_entries,
            "latest_analysis": latest_analysis_payload,
            "active_dates": [d.isoformat() for d in active_dates],
        }