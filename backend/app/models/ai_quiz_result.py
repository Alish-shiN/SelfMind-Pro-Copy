from sqlalchemy import ForeignKey, Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AIQuizResult(TimestampMixin, Base):
    __tablename__ = "ai_quiz_results"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_ai_quiz_results_session_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("ai_quiz_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    severity_level: Mapped[str] = mapped_column(String(50), nullable=False)
    insight: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    practice: Mapped[str] = mapped_column(Text, nullable=False)

    session = relationship("AIQuizSession", back_populates="result")