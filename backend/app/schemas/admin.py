from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

UserRole = Literal["user", "moderator", "admin"]
ModerationStatus = Literal["visible", "hidden", "pending_review"]
AdminContentType = Literal["motivational_prompt", "onboarding_tip", "ai_quiz_template"]


class AdminUserSummary(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    journal_entries_count: int
    ai_chat_sessions_count: int
    ai_chat_messages_count: int
    ai_quiz_sessions_count: int
    community_posts_count: int
    community_comments_count: int


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminAnalyticsOverview(BaseModel):
    total_users: int
    active_users: int
    total_journal_entries: int
    total_ai_chat_sessions: int
    total_ai_chat_messages: int
    total_ai_quizzes: int
    total_community_posts: int
    total_community_comments: int
    most_common_moods: list[dict[str, Any]]
    most_common_emotions: list[dict[str, Any]]


class AdminModerationUpdate(BaseModel):
    moderation_status: ModerationStatus
    moderation_reason: str | None = Field(default=None, max_length=1000)


class AdminCommunityPostModeration(BaseModel):
    id: int
    user_id: int
    username: str
    content: str
    is_anonymous: bool
    moderation_status: str
    moderation_reason: str | None
    moderated_at: datetime | None
    moderated_by_user_id: int | None
    comments_count: int
    created_at: datetime
    updated_at: datetime


class AdminCommunityCommentModeration(BaseModel):
    id: int
    post_id: int
    user_id: int
    username: str
    content: str
    is_anonymous: bool
    moderation_status: str
    moderation_reason: str | None
    moderated_at: datetime | None
    moderated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime


class AdminRiskItem(BaseModel):
    source: str
    id: int
    user_id: int | None
    username: str | None
    content: str
    matched_keywords: list[str]
    created_at: datetime


class AdminContentCreate(BaseModel):
    content_type: AdminContentType
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    content_metadata: dict[str, Any] | None = None
    is_active: bool = True


class AdminContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=10000)
    content_metadata: dict[str, Any] | None = None
    is_active: bool | None = None


class AdminContentResponse(BaseModel):
    id: int
    content_type: str
    title: str
    body: str
    content_metadata: dict[str, Any] | None
    is_active: bool
    created_by_user_id: int | None
    updated_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
