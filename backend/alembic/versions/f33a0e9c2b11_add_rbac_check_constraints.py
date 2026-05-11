"""add rbac check constraints

Revision ID: f33a0e9c2b11
Revises: b8a7d3c9e2f1
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f33a0e9c2b11'
down_revision: Union[str, Sequence[str], None] = 'b8a7d3c9e2f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        'ck_users_role_allowed',
        'users',
        "role in ('user', 'moderator', 'admin')",
    )
    op.create_check_constraint(
        'ck_community_posts_moderation_status_allowed',
        'community_posts',
        "moderation_status in ('visible', 'hidden', 'pending_review')",
    )
    op.create_check_constraint(
        'ck_community_comments_moderation_status_allowed',
        'community_comments',
        "moderation_status in ('visible', 'hidden', 'pending_review')",
    )
    op.create_check_constraint(
        'ck_admin_content_items_content_type_allowed',
        'admin_content_items',
        "content_type in ('motivational_prompt', 'onboarding_tip', 'ai_quiz_template')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_admin_content_items_content_type_allowed', 'admin_content_items', type_='check')
    op.drop_constraint('ck_community_comments_moderation_status_allowed', 'community_comments', type_='check')
    op.drop_constraint('ck_community_posts_moderation_status_allowed', 'community_posts', type_='check')
    op.drop_constraint('ck_users_role_allowed', 'users', type_='check')
