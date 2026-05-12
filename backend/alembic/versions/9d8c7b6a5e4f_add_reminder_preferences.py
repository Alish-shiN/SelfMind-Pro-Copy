"""add reminder preferences

Revision ID: 9d8c7b6a5e4f
Revises: f33a0e9c2b11
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d8c7b6a5e4f'
down_revision: Union[str, Sequence[str], None] = 'f33a0e9c2b11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'reminder_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('reminders_enabled', sa.Boolean(), nullable=False),
        sa.Column('journal_enabled', sa.Boolean(), nullable=False),
        sa.Column('mood_checkin_enabled', sa.Boolean(), nullable=False),
        sa.Column('ai_quiz_enabled', sa.Boolean(), nullable=False),
        sa.Column('journal_time', sa.String(length=5), nullable=False),
        sa.Column('mood_checkin_time', sa.String(length=5), nullable=False),
        sa.Column('ai_quiz_time', sa.String(length=5), nullable=False),
        sa.Column('frequency', sa.String(length=20), nullable=False),
        sa.Column('timezone', sa.String(length=80), nullable=False),
        sa.Column('push_token', sa.Text(), nullable=True),
        sa.Column('push_platform', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_reminder_preferences_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_reminder_preferences')),
        sa.UniqueConstraint('user_id', name='uq_reminder_preferences_user_id'),
    )
    op.create_index(op.f('ix_reminder_preferences_id'), 'reminder_preferences', ['id'], unique=False)
    op.create_index(op.f('ix_reminder_preferences_user_id'), 'reminder_preferences', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_reminder_preferences_user_id'), table_name='reminder_preferences')
    op.drop_index(op.f('ix_reminder_preferences_id'), table_name='reminder_preferences')
    op.drop_table('reminder_preferences')
