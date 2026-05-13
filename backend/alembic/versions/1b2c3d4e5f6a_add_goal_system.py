"""add goal system

Revision ID: 1b2c3d4e5f6a
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "1b2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = "0a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal_type", sa.String(length=30), nullable=False),
        sa.Column("target_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column(
            "period", sa.String(length=20), server_default="weekly", nullable=False
        ),
        sa.Column("template_key", sa.String(length=60), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "goal_type in ('reflection', 'mood_tracking', 'self_care', 'custom')",
            name=op.f("ck_goals_ck_goals_goal_type_allowed"),
        ),
        sa.CheckConstraint(
            "period in ('daily', 'weekly')",
            name=op.f("ck_goals_ck_goals_period_allowed"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goals_id"), "goals", ["id"], unique=False)
    op.create_index(op.f("ix_goals_user_id"), "goals", ["user_id"], unique=False)
    op.create_index(op.f("ix_goals_goal_type"), "goals", ["goal_type"], unique=False)
    op.create_index(
        op.f("ix_goals_template_key"), "goals", ["template_key"], unique=False
    )

    op.create_table(
        "goal_completions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_goal_completions_id"), "goal_completions", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_goal_completions_goal_id"),
        "goal_completions",
        ["goal_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_completions_user_id"),
        "goal_completions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_completions_user_id"), table_name="goal_completions")
    op.drop_index(op.f("ix_goal_completions_goal_id"), table_name="goal_completions")
    op.drop_index(op.f("ix_goal_completions_id"), table_name="goal_completions")
    op.drop_table("goal_completions")
    op.drop_index(op.f("ix_goals_template_key"), table_name="goals")
    op.drop_index(op.f("ix_goals_goal_type"), table_name="goals")
    op.drop_index(op.f("ix_goals_user_id"), table_name="goals")
    op.drop_index(op.f("ix_goals_id"), table_name="goals")
    op.drop_table("goals")
