"""add admin panel support

Revision ID: b8a7d3c9e2f1
Revises: 7f01279d93ed
Create Date: 2026-05-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b8a7d3c9e2f1'
down_revision: Union[str, Sequence[str], None] = '7f01279d93ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('role', sa.String(length=30), server_default='user', nullable=False))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column('users', sa.Column('deactivated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_users_role'), 'users', ['role'], unique=False)
    op.create_index(op.f('ix_users_is_active'), 'users', ['is_active'], unique=False)
    op.alter_column('users', 'role', server_default=None)
    op.alter_column('users', 'is_active', server_default=None)

    op.add_column('community_posts', sa.Column('moderation_status', sa.String(length=30), server_default='visible', nullable=False))
    op.add_column('community_posts', sa.Column('moderation_reason', sa.Text(), nullable=True))
    op.add_column('community_posts', sa.Column('moderated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('community_posts', sa.Column('moderated_by_user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_community_posts_moderation_status'), 'community_posts', ['moderation_status'], unique=False)
    op.alter_column('community_posts', 'moderation_status', server_default=None)

    op.add_column('community_comments', sa.Column('moderation_status', sa.String(length=30), server_default='visible', nullable=False))
    op.add_column('community_comments', sa.Column('moderation_reason', sa.Text(), nullable=True))
    op.add_column('community_comments', sa.Column('moderated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('community_comments', sa.Column('moderated_by_user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_community_comments_moderation_status'), 'community_comments', ['moderation_status'], unique=False)
    op.alter_column('community_comments', 'moderation_status', server_default=None)

    op.create_table(
        'admin_content_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('content_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('updated_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], name=op.f('fk_admin_content_items_created_by_user_id_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_user_id'], ['users.id'], name=op.f('fk_admin_content_items_updated_by_user_id_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_admin_content_items')),
    )
    op.create_index(op.f('ix_admin_content_items_id'), 'admin_content_items', ['id'], unique=False)
    op.create_index(op.f('ix_admin_content_items_content_type'), 'admin_content_items', ['content_type'], unique=False)
    op.create_index(op.f('ix_admin_content_items_is_active'), 'admin_content_items', ['is_active'], unique=False)
    op.create_index(op.f('ix_admin_content_items_created_by_user_id'), 'admin_content_items', ['created_by_user_id'], unique=False)
    op.create_index(op.f('ix_admin_content_items_updated_by_user_id'), 'admin_content_items', ['updated_by_user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_admin_content_items_updated_by_user_id'), table_name='admin_content_items')
    op.drop_index(op.f('ix_admin_content_items_created_by_user_id'), table_name='admin_content_items')
    op.drop_index(op.f('ix_admin_content_items_is_active'), table_name='admin_content_items')
    op.drop_index(op.f('ix_admin_content_items_content_type'), table_name='admin_content_items')
    op.drop_index(op.f('ix_admin_content_items_id'), table_name='admin_content_items')
    op.drop_table('admin_content_items')

    op.drop_index(op.f('ix_community_comments_moderation_status'), table_name='community_comments')
    op.drop_column('community_comments', 'moderated_by_user_id')
    op.drop_column('community_comments', 'moderated_at')
    op.drop_column('community_comments', 'moderation_reason')
    op.drop_column('community_comments', 'moderation_status')

    op.drop_index(op.f('ix_community_posts_moderation_status'), table_name='community_posts')
    op.drop_column('community_posts', 'moderated_by_user_id')
    op.drop_column('community_posts', 'moderated_at')
    op.drop_column('community_posts', 'moderation_reason')
    op.drop_column('community_posts', 'moderation_status')

    op.drop_index(op.f('ix_users_is_active'), table_name='users')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_column('users', 'deactivated_at')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'role')
