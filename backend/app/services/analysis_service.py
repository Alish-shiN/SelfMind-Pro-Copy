from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.analysis_repository import AnalysisRepository
from app.repo.journal_repository import JournalRepository
from app.services.ai_analysis_engine import AIAnalysisEngine

class AnalysisService:
    def __init__(self, db: Session):
        self.analysis_repo = AnalysisRepository(db)
        self.journal_repo = JournalRepository(db)
        self.engine = AIAnalysisEngine()

    def generate_for_entry(self, entry_id: int):
        entry = self.journal_repo.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        existing_analysis = self.analysis_repo.get_by_journal_entry_id(entry.id)
        if existing_analysis:
            return existing_analysis

        result = self.engine.analyze(
            title=entry.title,
            content=entry.content,
            mood_score=entry.mood_score,
        )

        return self.analysis_repo.create(
            journal_entry_id=entry.id,
            sentiment_label=result["sentiment_label"],
            emotion_label=result["emotion_label"],
            confidence_score=result["confidence_score"],
            short_summary=result["short_summary"],
            recommendation=result["recommendation"],
        )

    def regenerate_for_entry(self, current_user: User, entry_id: int):
        entry = self.journal_repo.get_by_id_and_user(entry_id, current_user.id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        self.analysis_repo.delete_by_journal_entry_id(entry.id)

        result = self.engine.analyze(
            title=entry.title,
            content=entry.content,
            mood_score=entry.mood_score,
        )

        return self.analysis_repo.create(
            journal_entry_id=entry.id,
            sentiment_label=result["sentiment_label"],
            emotion_label=result["emotion_label"],
            confidence_score=result["confidence_score"],
            short_summary=result["short_summary"],
            recommendation=result["recommendation"],
        )

    def get_entry_analysis(self, current_user: User, entry_id: int):
        entry = self.journal_repo.get_by_id_and_user(entry_id, current_user.id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )

        analysis = self.analysis_repo.get_by_journal_entry_id(entry.id)
        if not analysis:
            analysis = self.generate_for_entry(entry.id)

        return analysis