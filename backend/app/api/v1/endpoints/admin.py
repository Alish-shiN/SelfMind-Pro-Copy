import csv
from io import StringIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_moderator
from app.core.database import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminAnalyticsOverview,
    AdminCommunityCommentModeration,
    AdminCommunityPostModeration,
    AdminContentCreate,
    AdminContentResponse,
    AdminContentUpdate,
    AdminModerationUpdate,
    AdminRiskItem,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AdminUserSummary,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserSummary])
def list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).list_users()


@router.patch("/users/{user_id}/status", response_model=AdminUserSummary)
def update_user_status(
    user_id: int,
    payload: AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).update_user_status(current_admin, user_id, payload.is_active)


@router.patch("/users/{user_id}/role", response_model=AdminUserSummary)
def update_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).update_user_role(current_admin, user_id, payload.role)


@router.get("/analytics/overview", response_model=AdminAnalyticsOverview)
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).get_analytics_overview()


@router.get("/moderation/posts", response_model=list[AdminCommunityPostModeration])
def list_moderation_posts(
    moderation_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_moderator: User = Depends(get_current_moderator),
):
    return AdminService(db).list_moderation_posts(moderation_status)


@router.patch("/moderation/posts/{post_id}", response_model=AdminCommunityPostModeration)
def moderate_post(
    post_id: int,
    payload: AdminModerationUpdate,
    db: Session = Depends(get_db),
    current_moderator: User = Depends(get_current_moderator),
):
    return AdminService(db).moderate_post(post_id, payload, current_moderator)


@router.get("/moderation/comments", response_model=list[AdminCommunityCommentModeration])
def list_moderation_comments(
    moderation_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_moderator: User = Depends(get_current_moderator),
):
    return AdminService(db).list_moderation_comments(moderation_status)


@router.patch("/moderation/comments/{comment_id}", response_model=AdminCommunityCommentModeration)
def moderate_comment(
    comment_id: int,
    payload: AdminModerationUpdate,
    db: Session = Depends(get_db),
    current_moderator: User = Depends(get_current_moderator),
):
    return AdminService(db).moderate_comment(comment_id, payload, current_moderator)


@router.get("/safety/risk-items", response_model=list[AdminRiskItem])
def list_risk_items(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_moderator: User = Depends(get_current_moderator),
):
    return AdminService(db).list_risk_items(limit=limit)


@router.get("/content", response_model=list[AdminContentResponse])
def list_content(
    content_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).list_content(content_type)


@router.post("/content", response_model=AdminContentResponse, status_code=201)
def create_content(
    payload: AdminContentCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).create_content(payload, current_admin)


@router.patch("/content/{content_id}", response_model=AdminContentResponse)
def update_content(
    content_id: int,
    payload: AdminContentUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).update_content(content_id, payload, current_admin)


@router.delete("/content/{content_id}")
def delete_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return AdminService(db).delete_content(content_id)


@router.get("/reports/summary.csv")
def export_summary_report(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    analytics = AdminService(db).get_analytics_overview()
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["metric", "value"])
    for key, value in analytics.items():
        if isinstance(value, list):
            writer.writerow([key, str(value)])
        else:
            writer.writerow([key, value])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=selfmind-admin-summary.csv"},
    )
