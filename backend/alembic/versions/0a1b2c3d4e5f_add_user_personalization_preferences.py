"""add user personalization preferences

Revision ID: 0a1b2c3d4e5f
Revises: 8c9d0e1f2a3b
Create Date: 2026-05-12 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "8c9d0e1f2a3b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_PRIVACY = """'{"journal_private_default": true, "anonymous_community_default": false, "share_ai_insights": false}'::jsonb"""


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "emotional_goals",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "preferred_reflection_format",
            sa.String(length=30),
            server_default="diary",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "reminder_frequency",
            sa.String(length=30),
            server_default="none",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "privacy_preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text(DEFAULT_PRIVACY),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "ai_tone", sa.String(length=30), server_default="calm", nullable=False
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "onboarding_skipped",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )

    # Existing accounts should continue directly into the app and should not be
    # blocked by the new personalization onboarding.
    op.execute(
        "UPDATE users SET onboarding_completed = true WHERE onboarding_completed = false"
    )

    op.create_index(
        op.f("ix_users_preferred_reflection_format"),
        "users",
        ["preferred_reflection_format"],
        unique=False,
    )
    op.create_index(
        op.f("ix_users_reminder_frequency"),
        "users",
        ["reminder_frequency"],
        unique=False,
    )
    op.create_index(op.f("ix_users_ai_tone"), "users", ["ai_tone"], unique=False)
    op.create_index(
        op.f("ix_users_onboarding_completed"),
        "users",
        ["onboarding_completed"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_onboarding_completed"), table_name="users")
    op.drop_index(op.f("ix_users_ai_tone"), table_name="users")
    op.drop_index(op.f("ix_users_reminder_frequency"), table_name="users")
    op.drop_index(op.f("ix_users_preferred_reflection_format"), table_name="users")
    op.drop_column("users", "onboarding_skipped")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "ai_tone")
    op.drop_column("users", "privacy_preferences")
    op.drop_column("users", "reminder_frequency")
    op.drop_column("users", "preferred_reflection_format")
    op.drop_column("users", "emotional_goals")
