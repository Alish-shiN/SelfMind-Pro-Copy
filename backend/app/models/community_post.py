from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommunityPost(TimestampMixin, Base):
    __tablename__ = "community_posts"
    __table_args__ = (
        CheckConstraint(
            "moderation_status in ('visible', 'hidden', 'pending_review')",
            name="ck_community_posts_moderation_status_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    support_space: Mapped[str] = mapped_column(
        String(80), default="general", nullable=False, index=True
    )
    topic_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    moderation_status: Mapped[str] = mapped_column(
        String(30), default="visible", nullable=False, index=True
    )
    moderation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    moderated_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user = relationship("User", back_populates="community_posts")
    comments = relationship(
        "CommunityComment",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="CommunityComment.created_at",
    )
    reports = relationship(
        "CommunityReport",
        primaryjoin="and_(CommunityPost.id == foreign(CommunityReport.target_id), CommunityReport.target_type == 'post')",
        viewonly=True,
    )
    reactions = relationship(
        "CommunityReaction",
        primaryjoin="and_(CommunityPost.id == foreign(CommunityReaction.target_id), CommunityReaction.target_type == 'post')",
        viewonly=True,
    )
