from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ReminderPreference(TimestampMixin, Base):
    __tablename__ = "reminder_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_reminder_preferences_user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    journal_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mood_checkin_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ai_quiz_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    journal_time: Mapped[str] = mapped_column(String(5), default="20:00", nullable=False)
    mood_checkin_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    ai_quiz_time: Mapped[str] = mapped_column(String(5), default="18:00", nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), default="daily", nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC", nullable=False)
    push_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    push_platform: Mapped[str | None] = mapped_column(String(30), nullable=True)

    user = relationship("User")
