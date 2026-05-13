from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.ai_quiz_result import AIQuizResult
from app.models.ai_quiz_session import AIQuizSession
from app.models.journal import JournalEntry


class AnalyticsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_summary(
        self,
        user_id: int,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        query = self.db.query(
            func.count(JournalEntry.id).label("total_entries"),
            func.avg(JournalEntry.mood_score).label("average_mood"),
            func.min(JournalEntry.mood_score).label("min_mood"),
            func.max(JournalEntry.mood_score).label("max_mood"),
        ).filter(JournalEntry.user_id == user_id)
        query = self._apply_entry_date_range(query, start_date, end_date)
        result = query.one()

        return {
            "total_entries": result.total_entries or 0,
            "average_mood": (
                round(float(result.average_mood), 2)
                if result.average_mood is not None
                else None
            ),
            "min_mood": result.min_mood,
            "max_mood": result.max_mood,
        }

    def get_mood_history(
        self,
        user_id: int,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        query = (
            self.db.query(
                func.date(JournalEntry.created_at).label("date"),
                func.avg(JournalEntry.mood_score).label("average_mood"),
                func.count(JournalEntry.id).label("entries_count"),
            )
            .filter(JournalEntry.user_id == user_id)
            .group_by(func.date(JournalEntry.created_at))
            .order_by(func.date(JournalEntry.created_at))
        )
        query = self._apply_entry_date_range(query, start_date, end_date)
        result = query.all()

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

    def get_active_dates(
        self,
        user_id: int,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[date]:
        query = (
            self.db.query(func.date(JournalEntry.created_at).label("date"))
            .filter(JournalEntry.user_id == user_id)
            .group_by(func.date(JournalEntry.created_at))
            .order_by(func.date(JournalEntry.created_at))
        )
        query = self._apply_entry_date_range(query, start_date, end_date)
        result = query.all()

        return [self._coerce_date(row.date) for row in result]

    def get_entries_for_period(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> list[JournalEntry]:
        query = (
            self.db.query(JournalEntry)
            .options(joinedload(JournalEntry.analysis))
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.created_at.asc())
        )
        query = self._apply_entry_date_range(query, start_date, end_date)
        return query.all()

    def get_quiz_results_for_period(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> list[AIQuizResult]:
        query = (
            self.db.query(AIQuizResult)
            .join(AIQuizSession, AIQuizResult.session_id == AIQuizSession.id)
            .filter(AIQuizSession.user_id == user_id)
            .order_by(AIQuizResult.created_at.asc())
        )
        query = self._apply_quiz_result_date_range(query, start_date, end_date)
        return query.all()

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

    def _apply_entry_date_range(
        self, query, start_date: date | None, end_date: date | None
    ):
        if start_date:
            query = query.filter(
                JournalEntry.created_at >= self._start_of_day(start_date)
            )
        if end_date:
            query = query.filter(JournalEntry.created_at <= self._end_of_day(end_date))
        return query

    def _apply_quiz_result_date_range(
        self, query, start_date: date | None, end_date: date | None
    ):
        if start_date:
            query = query.filter(
                AIQuizResult.created_at >= self._start_of_day(start_date)
            )
        if end_date:
            query = query.filter(AIQuizResult.created_at <= self._end_of_day(end_date))
        return query

    def _start_of_day(self, value: date) -> datetime:
        return datetime.combine(value, time.min, tzinfo=timezone.utc)

    def _end_of_day(self, value: date) -> datetime:
        return datetime.combine(value, time.max, tzinfo=timezone.utc)

    def _coerce_date(self, value) -> date:
        if isinstance(value, date):
            return value
        return date.fromisoformat(str(value))
