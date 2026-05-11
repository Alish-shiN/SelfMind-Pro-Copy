"""add journal notification fields

Revision ID: 2b4c6d8e0f12
Revises: 9d8c7b6a5e4f
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b4c6d8e0f12'
down_revision: Union[str, Sequence[str], None] = '9d8c7b6a5e4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'journal_entries',
        sa.Column('push_notification_enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column('journal_entries', sa.Column('notification_title', sa.String(length=200), nullable=True))
    op.alter_column('journal_entries', 'push_notification_enabled', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('journal_entries', 'notification_title')
    op.drop_column('journal_entries', 'push_notification_enabled')
