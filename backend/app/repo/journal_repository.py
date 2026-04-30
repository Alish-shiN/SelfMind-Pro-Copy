from datetime import date as DateType, datetime, time, timezone

from sqlalchemy.orm import Session

from app.models.journal import JournalEntry


class JournalRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        user_id: int,
        title: str,
        content: str,
        mood_score: int,
        entry_date: DateType | None,
        tags: list[str] | None,
        is_private: bool,
    ) -> JournalEntry:
        created_at: datetime | None = None
        if entry_date is not None:
            # Store chosen calendar day as UTC midnight.
            created_at = datetime.combine(entry_date, time.min, tzinfo=timezone.utc)

        entry = JournalEntry(
            user_id=user_id,
            title=title,
            content=content,
            mood_score=mood_score,
            created_at=created_at,
            tags=tags,
            is_private=is_private,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_all_by_user(self, user_id: int) -> list[JournalEntry]:
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.created_at.desc())
            .all()
        )

    def get_by_id(self, entry_id: int) -> JournalEntry | None:
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.id == entry_id)
            .first()
        )

    def get_by_id_and_user(self, entry_id: int, user_id: int) -> JournalEntry | None:
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.id == entry_id, JournalEntry.user_id == user_id)
            .first()
        )

    def update(self, entry: JournalEntry, data: dict) -> JournalEntry:
        for field, value in data.items():
            setattr(entry, field, value)

        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete(self, entry: JournalEntry) -> None:
        self.db.delete(entry)
        self.db.commit()