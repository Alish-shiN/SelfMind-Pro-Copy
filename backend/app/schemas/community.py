from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SupportSpace = Literal[
    "general",
    "study_stress",
    "burnout",
    "exam_anxiety",
    "motivation",
]
ReactionType = Literal["support", "me_too", "sending_strength", "helpful"]
ReportReason = Literal["harassment", "hate", "spam", "unsafe", "inappropriate", "other"]
ModerationStatus = Literal["visible", "hidden", "pending_review"]


class CommunityAuthor(BaseModel):
    id: int | None = None
    username: str


class CommunityReactionSummary(BaseModel):
    support: int = 0
    me_too: int = 0
    sending_strength: int = 0
    helpful: int = 0


class SupportSpaceItem(BaseModel):
    key: str
    title: str
    description: str
    emoji: str


class CommunityGuidelinesResponse(BaseModel):
    title: str
    principles: list[str]
    report_reasons: list[str]
    support_spaces: list[SupportSpaceItem]


class CommunityPostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    is_anonymous: bool = False
    support_space: SupportSpace = "general"
    topic_tags: list[str] = Field(default_factory=list, max_length=5)


class CommunityCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    is_anonymous: bool = False


class CommunityReportCreate(BaseModel):
    reason: ReportReason
    details: str | None = Field(default=None, max_length=1000)


class CommunityReactionCreate(BaseModel):
    reaction_type: ReactionType


class CommunityModerationUpdate(BaseModel):
    moderation_status: ModerationStatus
    moderation_reason: str | None = Field(default=None, max_length=1000)


class CommunityReportResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    reason: str
    details: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunityCommentResponse(BaseModel):
    id: int
    post_id: int
    content: str
    is_anonymous: bool
    author: CommunityAuthor
    reactions: CommunityReactionSummary
    my_reactions: list[ReactionType] = []
    reports_count: int = 0
    created_at: datetime
    updated_at: datetime


class CommunityPostResponse(BaseModel):
    id: int
    content: str
    is_anonymous: bool
    support_space: str
    topic_tags: list[str]
    author: CommunityAuthor
    comments_count: int
    reactions: CommunityReactionSummary
    my_reactions: list[ReactionType] = []
    reports_count: int = 0
    created_at: datetime
    updated_at: datetime


class CommunityPostDetailResponse(BaseModel):
    id: int
    content: str
    is_anonymous: bool
    support_space: str
    topic_tags: list[str]
    author: CommunityAuthor
    comments_count: int
    reactions: CommunityReactionSummary
    my_reactions: list[ReactionType] = []
    reports_count: int = 0
    created_at: datetime
    updated_at: datetime
    comments: list[CommunityCommentResponse]


class CommunityModerationQueueItem(BaseModel):
    target_type: str
    target_id: int
    content: str
    author_username: str
    is_anonymous: bool
    moderation_status: str
    moderation_reason: str | None = None
    reports_count: int
    latest_report_reason: str | None = None
    created_at: datetime
