from sqlalchemy import ForeignKey, Float, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
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
    quiz_type: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    answers_snapshot: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    recommendations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    micro_practices: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    action_plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    trend_direction: Mapped[str | None] = mapped_column(
        String(30), nullable=True, index=True
    )
    previous_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_difference: Mapped[float | None] = mapped_column(Float, nullable=True)
    trend_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

    session = relationship("AIQuizSession", back_populates="result")
