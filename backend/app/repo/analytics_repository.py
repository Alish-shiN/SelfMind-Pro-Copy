from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.journal import JournalEntry


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_summary(self, user_id: int):
        result = (
            self.db.query(
                func.count(JournalEntry.id).label("total_entries"),
                func.avg(JournalEntry.mood_score).label("average_mood"),
                func.min(JournalEntry.mood_score).label("min_mood"),
                func.max(JournalEntry.mood_score).label("max_mood"),
            )
            .filter(JournalEntry.user_id == user_id)
            .one()
        )

        return {
            "total_entries": result.total_entries or 0,
            "average_mood": round(float(result.average_mood), 2) if result.average_mood is not None else None,
            "min_mood": result.min_mood,
            "max_mood": result.max_mood,
        }

    def get_mood_history(self, user_id: int):
        result = (
            self.db.query(
                func.date(JournalEntry.created_at).label("date"),
                func.avg(JournalEntry.mood_score).label("average_mood"),
                func.count(JournalEntry.id).label("entries_count"),
            )
            .filter(JournalEntry.user_id == user_id)
            .group_by(func.date(JournalEntry.created_at))
            .order_by(func.date(JournalEntry.created_at))
            .all()
        )

        return [
            {
                "date": str(row.date),
                "average_mood": round(float(row.average_mood), 2),
                "entries_count": row.entries_count,
            }
            for row in result
        ]

    def get_recent_entries(self, user_id: int, limit: int = 5):
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_active_dates(self, user_id: int) -> list[date]:
        result = (
            self.db.query(func.date(JournalEntry.created_at).label("date"))
            .filter(JournalEntry.user_id == user_id)
            .group_by(func.date(JournalEntry.created_at))
            .order_by(func.date(JournalEntry.created_at))
            .all()
        )

        return [row.date for row in result]

    def calculate_streaks(self, active_dates: list[date]):
        if not active_dates:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "total_active_days": 0,
            }

        sorted_dates = sorted(active_dates)
        total_active_days = len(sorted_dates)

        longest_streak = 1
        current_run = 1

        for i in range(1, len(sorted_dates)):
            if sorted_dates[i] == sorted_dates[i - 1] + timedelta(days=1):
                current_run += 1
            else:
                longest_streak = max(longest_streak, current_run)
                current_run = 1

        longest_streak = max(longest_streak, current_run)

        today = date.today()
        current_streak = 0

        active_set = set(sorted_dates)
        cursor = today

        while cursor in active_set:
            current_streak += 1
            cursor -= timedelta(days=1)

        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "total_active_days": total_active_days,
        }