from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class JournalAnalysis(TimestampMixin, Base):
    __tablename__ = "journal_analyses"
    __table_args__ = (
        UniqueConstraint("journal_entry_id", name="uq_journal_analyses_journal_entry_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    journal_entry_id: Mapped[int] = mapped_column(
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sentiment_label: Mapped[str] = mapped_column(String(50), nullable=False)
    emotion_label: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    short_summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    journal_entry = relationship("JournalEntry", back_populates="analysis")