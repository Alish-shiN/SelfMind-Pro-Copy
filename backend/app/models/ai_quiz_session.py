from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AIQuizSession(TimestampMixin, Base):
    __tablename__ = "ai_quiz_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quiz_type: Mapped[str] = mapped_column(String(100), nullable=False, default="stress_reflection")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="generated")
    generated_questions: Mapped[list] = mapped_column(JSONB, nullable=False)

    user = relationship("User", back_populates="ai_quiz_sessions")
    answers = relationship("AIQuizAnswer", back_populates="session", cascade="all, delete-orphan")
    result = relationship("AIQuizResult", back_populates="session", uselist=False, cascade="all, delete-orphan")