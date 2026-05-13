from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CommunityReaction(TimestampMixin, Base):
    __tablename__ = "community_reactions"
    __table_args__ = (
        CheckConstraint(
            "target_type in ('post', 'comment')",
            name="ck_community_reactions_target_type_allowed",
        ),
        CheckConstraint(
            "reaction_type in ('support', 'me_too', 'sending_strength', 'helpful')",
            name="ck_community_reactions_reaction_type_allowed",
        ),
        UniqueConstraint(
            "target_type",
            "target_id",
            "user_id",
            "reaction_type",
            name="uq_community_reactions_target_user_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reaction_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)

    user = relationship("User")
