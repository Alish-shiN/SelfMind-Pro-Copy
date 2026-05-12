"""add journal notification time

Revision ID: 6a7b8c9d0e1f
Revises: 4e5f6a7b8c9d
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6a7b8c9d0e1f'
down_revision: Union[str, Sequence[str], None] = '4e5f6a7b8c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('journal_entries', sa.Column('notification_time', sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column('journal_entries', 'notification_time')
