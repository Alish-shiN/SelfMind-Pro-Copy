from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.journal_repository import JournalRepository
from app.schemas.journal import JournalCreate, JournalUpdate
from app.services.analysis_service import AnalysisService


class JournalService:
    def __init__(self, db: Session):
        self.repo = JournalRepository(db)
        self.analysis_service = AnalysisService(db)

    def create_entry(self, current_user: User, payload: JournalCreate):
        entry = self.repo.create(
            user_id=current_user.id,
            title=payload.title,
            content=payload.content,
            mood_score=payload.mood_score,
            entry_date=payload.entry_date,
            tags=payload.tags,
            is_private=payload.is_private,
        )

        self.analysis_service.generate_for_entry(entry.id)
        return entry

    def get_my_entries(self, current_user: User):
        return self.repo.get_all_by_user(current_user.id)

    def get_my_entry(self, current_user: User, entry_id: int):
        entry = self.repo.get_by_id_and_user(entry_id, current_user.id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        return entry

    def update_entry(self, current_user: User, entry_id: int, payload: JournalUpdate):
        entry = self.repo.get_by_id_and_user(entry_id, current_user.id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        update_data = payload.model_dump(exclude_unset=True)
        updated_entry = self.repo.update(entry, update_data)

        self.analysis_service.regenerate_for_entry(current_user, updated_entry.id)

        return updated_entry

    def delete_entry(self, current_user: User, entry_id: int):
        entry = self.repo.get_by_id_and_user(entry_id, current_user.id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        self.repo.delete(entry)
        return {"message": "Journal entry deleted successfully"}