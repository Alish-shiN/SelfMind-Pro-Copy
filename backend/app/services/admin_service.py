from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.roles import ROLE_ADMIN, USER_ROLES
from app.models.admin_content import AdminContentItem
from app.models.ai_quiz_session import AIQuizSession
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.community_comment import CommunityComment
from app.models.community_post import CommunityPost
from app.models.journal import JournalEntry
from app.models.journal_analysis import JournalAnalysis
from app.models.user import User
from app.schemas.admin import AdminContentCreate, AdminContentUpdate, AdminModerationUpdate

RISK_KEYWORDS = (
    "suicide",
    "self harm",
    "self-harm",
    "kill myself",
    "end my life",
    "harm myself",
    "самоубий",
    "суицид",
    "умереть",
    "покончить с собой",
)


class AdminService:
    def __init__(self, db: Session):
        self.db = db

    def list_users(self) -> list[dict]:
        users = self.db.query(User).order_by(User.created_at.desc()).all()
        return [self._serialize_user_summary(user) for user in users]

    def update_user_status(self, actor: User, user_id: int, is_active: bool) -> dict:
        user = self._get_user_or_404(user_id)
        if actor.id == user.id and not is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot deactivate their own account",
            )
        if user.role == ROLE_ADMIN and not is_active:
            self._ensure_another_active_admin(user.id)

        user.is_active = is_active
        user.deactivated_at = None if is_active else datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(user)
        return self._serialize_user_summary(user)

    def update_user_role(self, actor: User, user_id: int, role: str) -> dict:
        if role not in USER_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role",
            )

        user = self._get_user_or_404(user_id)
        if actor.id == user.id and role != ROLE_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot remove their own admin role",
            )
        if user.role == ROLE_ADMIN and role != ROLE_ADMIN:
            self._ensure_another_active_admin(user.id)

        user.role = role
        self.db.commit()
        self.db.refresh(user)
        return self._serialize_user_summary(user)

    def get_analytics_overview(self) -> dict:
        total_users = self.db.query(func.count(User.id)).scalar() or 0
        active_users = self.db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
        total_journal_entries = self.db.query(func.count(JournalEntry.id)).scalar() or 0
        total_ai_chat_sessions = self.db.query(func.count(ChatSession.id)).scalar() or 0
        total_ai_chat_messages = self.db.query(func.count(ChatMessage.id)).scalar() or 0
        total_ai_quizzes = self.db.query(func.count(AIQuizSession.id)).scalar() or 0
        total_community_posts = self.db.query(func.count(CommunityPost.id)).scalar() or 0
        total_community_comments = self.db.query(func.count(CommunityComment.id)).scalar() or 0

        most_common_moods = [
            {"mood_score": mood_score, "count": count}
            for mood_score, count in (
                self.db.query(JournalEntry.mood_score, func.count(JournalEntry.id).label("count"))
                .group_by(JournalEntry.mood_score)
                .order_by(desc("count"))
                .limit(10)
                .all()
            )
        ]
        most_common_emotions = [
            {"emotion": emotion, "count": count}
            for emotion, count in (
                self.db.query(JournalAnalysis.emotion_label, func.count(JournalAnalysis.id).label("count"))
                .group_by(JournalAnalysis.emotion_label)
                .order_by(desc("count"))
                .limit(10)
                .all()
            )
        ]

        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_journal_entries": total_journal_entries,
            "total_ai_chat_sessions": total_ai_chat_sessions,
            "total_ai_chat_messages": total_ai_chat_messages,
            "total_ai_quizzes": total_ai_quizzes,
            "total_community_posts": total_community_posts,
            "total_community_comments": total_community_comments,
            "most_common_moods": most_common_moods,
            "most_common_emotions": most_common_emotions,
        }

    def list_moderation_posts(self, status_filter: str | None = None) -> list[dict]:
        query = self.db.query(CommunityPost).options(
            joinedload(CommunityPost.user),
            joinedload(CommunityPost.comments),
        )
        if status_filter:
            query = query.filter(CommunityPost.moderation_status == status_filter)
        posts = query.order_by(CommunityPost.created_at.desc()).all()
        return [self._serialize_moderation_post(post) for post in posts]

    def list_moderation_comments(self, status_filter: str | None = None) -> list[dict]:
        query = self.db.query(CommunityComment).options(joinedload(CommunityComment.user))
        if status_filter:
            query = query.filter(CommunityComment.moderation_status == status_filter)
        comments = query.order_by(CommunityComment.created_at.desc()).all()
        return [self._serialize_moderation_comment(comment) for comment in comments]

    def moderate_post(self, post_id: int, payload: AdminModerationUpdate, moderator: User) -> dict:
        post = self.db.query(CommunityPost).options(joinedload(CommunityPost.user), joinedload(CommunityPost.comments)).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
        self._apply_moderation(post, payload, moderator.id)
        self.db.commit()
        self.db.refresh(post)
        return self._serialize_moderation_post(post)

    def moderate_comment(self, comment_id: int, payload: AdminModerationUpdate, moderator: User) -> dict:
        comment = self.db.query(CommunityComment).options(joinedload(CommunityComment.user)).filter(CommunityComment.id == comment_id).first()
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        self._apply_moderation(comment, payload, moderator.id)
        self.db.commit()
        self.db.refresh(comment)
        return self._serialize_moderation_comment(comment)

    def list_risk_items(self, limit: int = 50) -> list[dict]:
        items: list[dict] = []
        items.extend(self._risk_items_for_model(JournalEntry, "journal_entry", JournalEntry.content, limit))
        items.extend(self._risk_items_for_model(ChatMessage, "chat_message", ChatMessage.content, limit))
        items.extend(self._risk_items_for_model(CommunityPost, "community_post", CommunityPost.content, limit))
        items.extend(self._risk_items_for_model(CommunityComment, "community_comment", CommunityComment.content, limit))
        return sorted(items, key=lambda item: item["created_at"], reverse=True)[:limit]

    def list_content(self, content_type: str | None = None) -> list[AdminContentItem]:
        query = self.db.query(AdminContentItem)
        if content_type:
            query = query.filter(AdminContentItem.content_type == content_type)
        return query.order_by(AdminContentItem.created_at.desc()).all()

    def create_content(self, payload: AdminContentCreate, admin: User) -> AdminContentItem:
        item = AdminContentItem(
            content_type=payload.content_type,
            title=payload.title,
            body=payload.body,
            content_metadata=payload.content_metadata,
            is_active=payload.is_active,
            created_by_user_id=admin.id,
            updated_by_user_id=admin.id,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_content(self, content_id: int, payload: AdminContentUpdate, admin: User) -> AdminContentItem:
        item = self.db.query(AdminContentItem).filter(AdminContentItem.id == content_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        item.updated_by_user_id = admin.id
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_content(self, content_id: int) -> dict:
        item = self.db.query(AdminContentItem).filter(AdminContentItem.id == content_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        self.db.delete(item)
        self.db.commit()
        return {"message": "Content item deleted successfully"}

    def _get_user_or_404(self, user_id: int) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    def _ensure_another_active_admin(self, user_id: int) -> None:
        active_admins = (
            self.db.query(func.count(User.id))
            .filter(
                User.role == ROLE_ADMIN,
                User.is_active.is_(True),
                User.id != user_id,
            )
            .scalar()
            or 0
        )
        if active_admins < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active admin account must remain",
            )

    def _serialize_user_summary(self, user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "journal_entries_count": self.db.query(func.count(JournalEntry.id)).filter(JournalEntry.user_id == user.id).scalar() or 0,
            "ai_chat_sessions_count": self.db.query(func.count(ChatSession.id)).filter(ChatSession.user_id == user.id).scalar() or 0,
            "ai_chat_messages_count": self.db.query(func.count(ChatMessage.id)).join(ChatSession).filter(ChatSession.user_id == user.id).scalar() or 0,
            "ai_quiz_sessions_count": self.db.query(func.count(AIQuizSession.id)).filter(AIQuizSession.user_id == user.id).scalar() or 0,
            "community_posts_count": self.db.query(func.count(CommunityPost.id)).filter(CommunityPost.user_id == user.id).scalar() or 0,
            "community_comments_count": self.db.query(func.count(CommunityComment.id)).filter(CommunityComment.user_id == user.id).scalar() or 0,
        }

    def _apply_moderation(self, obj, payload: AdminModerationUpdate, moderator_id: int) -> None:
        obj.moderation_status = payload.moderation_status
        obj.moderation_reason = payload.moderation_reason
        obj.moderated_at = datetime.now(timezone.utc)
        obj.moderated_by_user_id = moderator_id

    def _serialize_moderation_post(self, post: CommunityPost) -> dict:
        return {
            "id": post.id,
            "user_id": post.user_id,
            "username": post.user.username,
            "content": post.content,
            "is_anonymous": post.is_anonymous,
            "moderation_status": post.moderation_status,
            "moderation_reason": post.moderation_reason,
            "moderated_at": post.moderated_at,
            "moderated_by_user_id": post.moderated_by_user_id,
            "comments_count": len(post.comments) if post.comments is not None else 0,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }

    def _serialize_moderation_comment(self, comment: CommunityComment) -> dict:
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "username": comment.user.username,
            "content": comment.content,
            "is_anonymous": comment.is_anonymous,
            "moderation_status": comment.moderation_status,
            "moderation_reason": comment.moderation_reason,
            "moderated_at": comment.moderated_at,
            "moderated_by_user_id": comment.moderated_by_user_id,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
        }

    def _risk_items_for_model(self, model, source: str, content_column, limit: int) -> list[dict]:
        filters = [content_column.ilike(f"%{keyword}%") for keyword in RISK_KEYWORDS]
        rows = self.db.query(model).filter(or_(*filters)).order_by(model.created_at.desc()).limit(limit).all()
        result = []
        for row in rows:
            content = row.content
            lowered_content = content.lower()
            matched_keywords = [keyword for keyword in RISK_KEYWORDS if keyword.lower() in lowered_content]
            user_id = getattr(row, "user_id", None)
            username = None
            if source == "chat_message":
                session = self.db.query(ChatSession).options(joinedload(ChatSession.user)).filter(ChatSession.id == row.session_id).first()
                user_id = session.user_id if session else None
                username = session.user.username if session else None
            elif user_id:
                user = self.db.query(User).filter(User.id == user_id).first()
                username = user.username if user else None
            result.append({
                "source": source,
                "id": row.id,
                "user_id": user_id,
                "username": username,
                "content": content,
                "matched_keywords": matched_keywords,
                "created_at": row.created_at,
            })
        return result
