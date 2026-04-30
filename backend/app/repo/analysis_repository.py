from sqlalchemy.orm import Session

from app.models.journal_analysis import JournalAnalysis


class AnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        journal_entry_id: int,
        sentiment_label: str,
        emotion_label: str,
        confidence_score: float,
        short_summary: str,
        recommendation: str,
    ) -> JournalAnalysis:
        analysis = JournalAnalysis(
            journal_entry_id=journal_entry_id,
            sentiment_label=sentiment_label,
            emotion_label=emotion_label,
            confidence_score=confidence_score,
            short_summary=short_summary,
            recommendation=recommendation,
        )
        self.db.add(analysis)
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def get_by_journal_entry_id(self, journal_entry_id: int) -> JournalAnalysis | None:
        return (
            self.db.query(JournalAnalysis)
            .filter(JournalAnalysis.journal_entry_id == journal_entry_id)
            .first()
        )

    def delete(self, analysis: JournalAnalysis) -> None:
        self.db.delete(analysis)
        self.db.commit()

    def delete_by_journal_entry_id(self, journal_entry_id: int) -> None:
        analysis = self.get_by_journal_entry_id(journal_entry_id)
        if analysis:
            self.db.delete(analysis)
            self.db.commit()