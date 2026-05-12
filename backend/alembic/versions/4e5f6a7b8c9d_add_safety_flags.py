"""add safety flags

Revision ID: 4e5f6a7b8c9d
Revises: 2b4c6d8e0f12
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '4e5f6a7b8c9d'
down_revision: Union[str, Sequence[str], None] = '2b4c6d8e0f12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'safety_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=True),
        sa.Column('severity', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('matched_signals', postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column('content_excerpt', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_safety_flags_user_id_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_safety_flags')),
    )
    op.create_index(op.f('ix_safety_flags_id'), 'safety_flags', ['id'], unique=False)
    op.create_index(op.f('ix_safety_flags_user_id'), 'safety_flags', ['user_id'], unique=False)
    op.create_index(op.f('ix_safety_flags_source_type'), 'safety_flags', ['source_type'], unique=False)
    op.create_index(op.f('ix_safety_flags_source_id'), 'safety_flags', ['source_id'], unique=False)
    op.create_index(op.f('ix_safety_flags_severity'), 'safety_flags', ['severity'], unique=False)
    op.create_index(op.f('ix_safety_flags_status'), 'safety_flags', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_safety_flags_status'), table_name='safety_flags')
    op.drop_index(op.f('ix_safety_flags_severity'), table_name='safety_flags')
    op.drop_index(op.f('ix_safety_flags_source_id'), table_name='safety_flags')
    op.drop_index(op.f('ix_safety_flags_source_type'), table_name='safety_flags')
    op.drop_index(op.f('ix_safety_flags_user_id'), table_name='safety_flags')
    op.drop_index(op.f('ix_safety_flags_id'), table_name='safety_flags')
    op.drop_table('safety_flags')
