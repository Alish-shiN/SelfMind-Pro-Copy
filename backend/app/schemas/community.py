from datetime import datetime

from pydantic import BaseModel, Field


class CommunityAuthor(BaseModel):
    id: int | None = None
    username: str

class CommunityPostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    is_anonymous: bool = False


class CommunityCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    is_anonymous: bool = False


class CommunityCommentResponse(BaseModel):
    id: int
    post_id: int
    content: str
    is_anonymous: bool
    author: CommunityAuthor
    created_at: datetime
    updated_at: datetime


class CommunityPostResponse(BaseModel):
    id: int
    content: str
    is_anonymous: bool
    author: CommunityAuthor
    comments_count: int
    created_at: datetime
    updated_at: datetime


class CommunityPostDetailResponse(BaseModel):
    id: int
    content: str
    is_anonymous: bool
    author: CommunityAuthor
    comments_count: int
    created_at: datetime
    updated_at: datetime
    comments: list[CommunityCommentResponse]