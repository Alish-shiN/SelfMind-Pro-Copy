from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class GoalCompletion(TimestampMixin, Base):
    __tablename__ = "goal_completions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    goal_id: Mapped[int] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    goal = relationship("Goal", back_populates="completions")
    user = relationship("User")
