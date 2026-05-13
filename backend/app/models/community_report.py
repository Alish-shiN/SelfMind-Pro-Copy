from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommunityReport(TimestampMixin, Base):
    __tablename__ = "community_reports"
    __table_args__ = (
        CheckConstraint(
            "target_type in ('post', 'comment')",
            name="ck_community_reports_target_type_allowed",
        ),
        CheckConstraint(
            "status in ('open', 'reviewed', 'dismissed')",
            name="ck_community_reports_status_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reporter_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="open", nullable=False, index=True
    )

    reporter = relationship("User")
