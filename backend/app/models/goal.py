from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Goal(TimestampMixin, Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "goal_type in ('reflection', 'mood_tracking', 'self_care', 'custom')",
            name="ck_goals_goal_type_allowed",
        ),
        CheckConstraint(
            "period in ('daily', 'weekly')",
            name="ck_goals_period_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    target_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    period: Mapped[str] = mapped_column(String(20), default="weekly", nullable=False)
    template_key: Mapped[str | None] = mapped_column(
        String(60), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="goals")
    completions = relationship(
        "GoalCompletion", back_populates="goal", cascade="all, delete-orphan"
    )
