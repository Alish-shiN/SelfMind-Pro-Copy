"""extend ai quiz results

Revision ID: 2c3d4e5f6a7b
Revises: 1b2c3d4e5f6a
Create Date: 2026-05-13 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2c3d4e5f6a7b"
down_revision: Union[str, Sequence[str], None] = "1b2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_quiz_results", sa.Column("quiz_type", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "ai_quiz_results",
        sa.Column(
            "answers_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column(
        "ai_quiz_results",
        sa.Column(
            "recommendations", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column(
        "ai_quiz_results",
        sa.Column(
            "micro_practices", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column(
        "ai_quiz_results",
        sa.Column(
            "action_plan", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column(
        "ai_quiz_results",
        sa.Column("trend_direction", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "ai_quiz_results", sa.Column("previous_score", sa.Float(), nullable=True)
    )
    op.add_column(
        "ai_quiz_results", sa.Column("score_difference", sa.Float(), nullable=True)
    )
    op.add_column(
        "ai_quiz_results", sa.Column("trend_explanation", sa.Text(), nullable=True)
    )
    op.create_index(
        op.f("ix_ai_quiz_results_quiz_type"),
        "ai_quiz_results",
        ["quiz_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_quiz_results_trend_direction"),
        "ai_quiz_results",
        ["trend_direction"],
        unique=False,
    )

    op.execute("""
        UPDATE ai_quiz_results
        SET quiz_type = ai_quiz_sessions.quiz_type
        FROM ai_quiz_sessions
        WHERE ai_quiz_results.session_id = ai_quiz_sessions.id
          AND ai_quiz_results.quiz_type IS NULL
        """)


def downgrade() -> None:
    op.drop_index(
        op.f("ix_ai_quiz_results_trend_direction"), table_name="ai_quiz_results"
    )
    op.drop_index(op.f("ix_ai_quiz_results_quiz_type"), table_name="ai_quiz_results")
    op.drop_column("ai_quiz_results", "trend_explanation")
    op.drop_column("ai_quiz_results", "score_difference")
    op.drop_column("ai_quiz_results", "previous_score")
    op.drop_column("ai_quiz_results", "trend_direction")
    op.drop_column("ai_quiz_results", "action_plan")
    op.drop_column("ai_quiz_results", "micro_practices")
    op.drop_column("ai_quiz_results", "recommendations")
    op.drop_column("ai_quiz_results", "answers_snapshot")
    op.drop_column("ai_quiz_results", "quiz_type")
