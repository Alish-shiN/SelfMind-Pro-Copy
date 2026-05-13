from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.community import (
    CommunityCommentCreate,
    CommunityCommentResponse,
    CommunityGuidelinesResponse,
    CommunityModerationQueueItem,
    CommunityModerationUpdate,
    CommunityPostCreate,
    CommunityPostDetailResponse,
    CommunityPostResponse,
    CommunityReactionCreate,
    CommunityReportCreate,
    CommunityReportResponse,
)
from app.services.community_service import CommunityService

router = APIRouter(prefix="/community", tags=["community"])


@router.get("/guidelines", response_model=CommunityGuidelinesResponse)
def get_guidelines(db: Session = Depends(get_db)):
    return CommunityService(db).get_guidelines()


@router.post(
    "/posts", response_model=CommunityPostResponse, status_code=status.HTTP_201_CREATED
)
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
    support_space: str | None = Query(default=None),
    topic_tag: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return CommunityService(db).get_feed(
        limit=limit,
        offset=offset,
        support_space=support_space,
        topic_tag=topic_tag,
    )


@router.get("/moderation/queue", response_model=list[CommunityModerationQueueItem])
def get_moderation_queue(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).get_moderation_queue(current_user, limit)


@router.patch("/moderation/posts/{post_id}", response_model=CommunityPostResponse)
def moderate_post(
    post_id: int,
    payload: CommunityModerationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).moderate_post(current_user, post_id, payload)


@router.patch(
    "/moderation/comments/{comment_id}", response_model=CommunityCommentResponse
)
def moderate_comment(
    comment_id: int,
    payload: CommunityModerationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).moderate_comment(current_user, comment_id, payload)


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


@router.post("/posts/{post_id}/report", response_model=CommunityReportResponse)
def report_post(
    post_id: int,
    payload: CommunityReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).report_post(current_user, post_id, payload)


@router.post("/posts/{post_id}/reactions")
def react_to_post(
    post_id: int,
    payload: CommunityReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).react_to_post(current_user, post_id, payload)


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


@router.post("/comments/{comment_id}/report", response_model=CommunityReportResponse)
def report_comment(
    comment_id: int,
    payload: CommunityReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).report_comment(current_user, comment_id, payload)


@router.post("/comments/{comment_id}/reactions")
def react_to_comment(
    comment_id: int,
    payload: CommunityReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunityService(db).react_to_comment(current_user, comment_id, payload)
