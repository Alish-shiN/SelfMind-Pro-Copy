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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommunityComment(TimestampMixin, Base):
    __tablename__ = "community_comments"
    __table_args__ = (
        CheckConstraint(
            "moderation_status in ('visible', 'hidden', 'pending_review')",
            name="ck_community_comments_moderation_status_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    moderation_status: Mapped[str] = mapped_column(
        String(30), default="visible", nullable=False, index=True
    )
    moderation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    moderated_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    post = relationship("CommunityPost", back_populates="comments")
    user = relationship("User", back_populates="community_comments")

    reports = relationship(
        "CommunityReport",
        primaryjoin="and_(CommunityComment.id == foreign(CommunityReport.target_id), CommunityReport.target_type == 'comment')",
        viewonly=True,
    )
    reactions = relationship(
        "CommunityReaction",
        primaryjoin="and_(CommunityComment.id == foreign(CommunityReaction.target_id), CommunityReaction.target_type == 'comment')",
        viewonly=True,
    )
