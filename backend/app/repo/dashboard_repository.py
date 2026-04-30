from sqlalchemy.orm import Session

from app.models.journal import JournalEntry
from app.models.journal_analysis import JournalAnalysis


class DashboardRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_recent_entries(self, user_id: int, limit: int = 5):
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_latest_analysis(self, user_id: int):
        return (
            self.db.query(JournalAnalysis)
            .join(JournalEntry, JournalAnalysis.journal_entry_id == JournalEntry.id)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalAnalysis.created_at.desc())
            .first()
        )