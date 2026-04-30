from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.community import (
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityPostCreate,
    CommunityPostDetailResponse,
    CommunityPostResponse,
)
from app.services.community_service import CommunityService

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/posts", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).create_post(current_user, payload)


@router.get("/posts", response_model=list[CommunityPostResponse])
def get_feed(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return CommunityService(db).get_feed(limit=limit, offset=offset)


@router.get("/posts/{post_id}", response_model=CommunityPostDetailResponse)
def get_post_detail(
    post_id: int,
    db: Session = Depends(get_db),
):
    return CommunityService(db).get_post_detail(post_id)


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).delete_post(current_user, post_id)


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommunityCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: int,
    payload: CommunityCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).create_comment(current_user, post_id, payload)


@router.get("/posts/{post_id}/comments", response_model=list[CommunityCommentResponse])
def get_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    return CommunityService(db).get_comments(post_id)


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).delete_comment(current_user, comment_id)