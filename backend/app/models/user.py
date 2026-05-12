from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.roles import ROLE_USER
from app.models.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role in ('user', 'moderator', 'admin')", name="ck_users_role_allowed"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(30), default=ROLE_USER, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, index=True
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    emotional_goals: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False
    )
    preferred_reflection_format: Mapped[str] = mapped_column(
        String(30), default="diary", nullable=False, index=True
    )
    reminder_frequency: Mapped[str] = mapped_column(
        String(30), default="none", nullable=False, index=True
    )
    privacy_preferences: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "journal_private_default": True,
            "anonymous_community_default": False,
            "share_ai_insights": False,
        },
        nullable=False,
    )
    ai_tone: Mapped[str] = mapped_column(
        String(30), default="calm", nullable=False, index=True
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    onboarding_skipped: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    profile = relationship(
        "Profile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    journal_entries = relationship(
        "JournalEntry", back_populates="user", cascade="all, delete-orphan"
    )
    chat_sessions = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )
    community_posts = relationship(
        "CommunityPost", back_populates="user", cascade="all, delete-orphan"
    )
    community_comments = relationship(
        "CommunityComment", back_populates="user", cascade="all, delete-orphan"
    )
    ai_quiz_sessions = relationship(
        "AIQuizSession", back_populates="user", cascade="all, delete-orphan"
    )
