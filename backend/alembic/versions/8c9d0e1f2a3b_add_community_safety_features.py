"""add community safety features

Revision ID: 8c9d0e1f2a3b
Revises: 6a7b8c9d0e1f
Create Date: 2026-05-12 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8c9d0e1f2a3b"
down_revision: Union[str, Sequence[str], None] = "6a7b8c9d0e1f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "community_posts",
        sa.Column(
            "support_space",
            sa.String(length=80),
            server_default="general",
            nullable=False,
        ),
    )
    op.add_column(
        "community_posts",
        sa.Column("topic_tags", postgresql.ARRAY(sa.String()), nullable=True),
    )
    op.create_index(
        op.f("ix_community_posts_support_space"),
        "community_posts",
        ["support_space"],
        unique=False,
    )
    op.alter_column("community_posts", "support_space", server_default=None)

    op.create_table(
        "community_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reporter_user_id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=100), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_type in ('post', 'comment')",
            name=op.f("ck_community_reports_target_type_allowed"),
        ),
        sa.CheckConstraint(
            "status in ('open', 'reviewed', 'dismissed')",
            name=op.f("ck_community_reports_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["reporter_user_id"],
            ["users.id"],
            name=op.f("fk_community_reports_reporter_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_community_reports")),
    )
    op.create_index(
        op.f("ix_community_reports_id"), "community_reports", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_community_reports_reporter_user_id"),
        "community_reports",
        ["reporter_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reports_target_type"),
        "community_reports",
        ["target_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reports_target_id"),
        "community_reports",
        ["target_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reports_status"),
        "community_reports",
        ["status"],
        unique=False,
    )

    op.create_table(
        "community_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction_type", sa.String(length=40), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_type in ('post', 'comment')",
            name=op.f("ck_community_reactions_target_type_allowed"),
        ),
        sa.CheckConstraint(
            "reaction_type in ('support', 'me_too', 'sending_strength', 'helpful')",
            name=op.f("ck_community_reactions_reaction_type_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_community_reactions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_community_reactions")),
        sa.UniqueConstraint(
            "target_type",
            "target_id",
            "user_id",
            "reaction_type",
            name="uq_community_reactions_target_user_type",
        ),
    )
    op.create_index(
        op.f("ix_community_reactions_id"), "community_reactions", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_community_reactions_target_type"),
        "community_reactions",
        ["target_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reactions_target_id"),
        "community_reactions",
        ["target_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reactions_user_id"),
        "community_reactions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_community_reactions_reaction_type"),
        "community_reactions",
        ["reaction_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_community_reactions_reaction_type"), table_name="community_reactions"
    )
    op.drop_index(
        op.f("ix_community_reactions_user_id"), table_name="community_reactions"
    )
    op.drop_index(
        op.f("ix_community_reactions_target_id"), table_name="community_reactions"
    )
    op.drop_index(
        op.f("ix_community_reactions_target_type"), table_name="community_reactions"
    )
    op.drop_index(op.f("ix_community_reactions_id"), table_name="community_reactions")
    op.drop_table("community_reactions")

    op.drop_index(op.f("ix_community_reports_status"), table_name="community_reports")
    op.drop_index(
        op.f("ix_community_reports_target_id"), table_name="community_reports"
    )
    op.drop_index(
        op.f("ix_community_reports_target_type"), table_name="community_reports"
    )
    op.drop_index(
        op.f("ix_community_reports_reporter_user_id"), table_name="community_reports"
    )
    op.drop_index(op.f("ix_community_reports_id"), table_name="community_reports")
    op.drop_table("community_reports")

    op.drop_index(
        op.f("ix_community_posts_support_space"), table_name="community_posts"
    )
    op.drop_column("community_posts", "topic_tags")
    op.drop_column("community_posts", "support_space")
