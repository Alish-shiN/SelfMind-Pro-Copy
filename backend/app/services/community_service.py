from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.roles import is_moderator_or_admin
from app.models.user import User
from app.repo.community_repository import CommunityRepository
from app.schemas.community import (
    CommunityCommentCreate,
    CommunityModerationUpdate,
    CommunityPostCreate,
    CommunityReactionCreate,
    CommunityReportCreate,
)
from app.services.safety_service import SafetyService

SUPPORT_SPACES = [
    {
        "key": "general",
        "title": "General support",
        "description": "Open reflection, encouragement, and daily check-ins.",
        "emoji": "💬",
    },
    {
        "key": "study_stress",
        "title": "Study stress",
        "description": "Workload, deadlines, classes, and academic pressure.",
        "emoji": "📚",
    },
    {
        "key": "burnout",
        "title": "Burnout",
        "description": "Exhaustion, low energy, and needing sustainable routines.",
        "emoji": "🪫",
    },
    {
        "key": "exam_anxiety",
        "title": "Anxiety before exams",
        "description": "Pre-exam worries, test nerves, and grounding before assessments.",
        "emoji": "📝",
    },
    {
        "key": "motivation",
        "title": "Motivation",
        "description": "Encouragement, small wins, and getting unstuck.",
        "emoji": "🌱",
    },
]

GUIDELINES = [
    "Be supportive: respond with encouragement, validation, and practical kindness.",
    "No harassment, hate, bullying, graphic content, or shaming.",
    "Avoid diagnosis or medical instructions; encourage professional or emergency help when safety is at risk.",
    "Respect privacy. Do not pressure anyone to reveal identity or personal details.",
    "Use reports for unsafe, inappropriate, spammy, or harmful content so moderators can review it.",
]


class CommunityService:
    def __init__(self, db: Session):
        self.repo = CommunityRepository(db)
        self.safety_service = SafetyService(db)

    def get_guidelines(self) -> dict:
        return {
            "title": "Community guidelines",
            "principles": GUIDELINES,
            "report_reasons": [
                "harassment",
                "hate",
                "spam",
                "unsafe",
                "inappropriate",
                "other",
            ],
            "support_spaces": SUPPORT_SPACES,
        }

    def create_post(self, current_user: User, payload: CommunityPostCreate):
        post = self.repo.create_post(
            user_id=current_user.id,
            content=payload.content,
            is_anonymous=payload.is_anonymous,
            support_space=payload.support_space,
            topic_tags=self._normalize_tags(payload.topic_tags),
        )
        self.safety_service.flag_if_needed(
            current_user, "community_post", post.id, payload.content
        )
        post = self._auto_review_if_needed(post, payload.content, current_user.id)
        return self._serialize_post(post)

    def get_feed(
        self,
        limit: int = 20,
        offset: int = 0,
        support_space: str | None = None,
        topic_tag: str | None = None,
    ):
        posts = self.repo.get_posts(
            limit=limit,
            offset=offset,
            support_space=support_space,
            topic_tag=topic_tag,
        )
        return [self._serialize_post(post) for post in posts]

    def get_post_detail(self, post_id: int):
        post = self.repo.get_post_by_id(post_id)
        if not post or post.moderation_status != "visible":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )

        comments = [
            self._serialize_comment(comment)
            for comment in post.comments
            if comment.moderation_status == "visible"
        ]

        return {
            **self._serialize_post(post),
            "comments": comments,
        }

    def delete_post(self, current_user: User, post_id: int):
        post = self.repo.get_post_by_id(post_id)
        if not post or not self._can_manage_content(current_user, post.user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found or access denied",
            )

        self.repo.delete_post(post)
        return {"message": "Post deleted successfully"}

    def create_comment(
        self, current_user: User, post_id: int, payload: CommunityCommentCreate
    ):
        post = self.repo.get_post_by_id(post_id)
        if not post or post.moderation_status != "visible":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )

        comment = self.repo.create_comment(
            post_id=post_id,
            user_id=current_user.id,
            content=payload.content,
            is_anonymous=payload.is_anonymous,
        )

        self.safety_service.flag_if_needed(
            current_user, "community_comment", comment.id, payload.content
        )
        comment = self._auto_review_if_needed(comment, payload.content, current_user.id)
        comment = self.repo.get_comment_by_id(comment.id)
        return self._serialize_comment(comment)

    def get_comments(self, post_id: int):
        post = self.repo.get_post_by_id(post_id)
        if not post or post.moderation_status != "visible":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )

        comments = self.repo.get_comments_by_post_id(post_id)
        return [self._serialize_comment(comment) for comment in comments]

    def delete_comment(self, current_user: User, comment_id: int):
        comment = self.repo.get_comment_by_id(comment_id)
        if not comment or not self._can_manage_content(current_user, comment.user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found or access denied",
            )

        self.repo.delete_comment(comment)
        return {"message": "Comment deleted successfully"}

    def report_post(
        self, current_user: User, post_id: int, payload: CommunityReportCreate
    ):
        post = self.repo.get_post_by_id(post_id)
        if not post or post.moderation_status == "hidden":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )
        report = self.repo.create_report(
            current_user.id, "post", post.id, payload.reason, payload.details
        )
        self.repo.set_moderation_status(
            post,
            "pending_review",
            f"Reported by community: {payload.reason}",
            current_user.id,
        )
        return report

    def report_comment(
        self, current_user: User, comment_id: int, payload: CommunityReportCreate
    ):
        comment = self.repo.get_comment_by_id(comment_id)
        if not comment or comment.moderation_status == "hidden":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
            )
        report = self.repo.create_report(
            current_user.id, "comment", comment.id, payload.reason, payload.details
        )
        self.repo.set_moderation_status(
            comment,
            "pending_review",
            f"Reported by community: {payload.reason}",
            current_user.id,
        )
        return report

    def react_to_post(
        self, current_user: User, post_id: int, payload: CommunityReactionCreate
    ):
        post = self.repo.get_post_by_id(post_id)
        if not post or post.moderation_status != "visible":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )
        active = self.repo.toggle_reaction(
            current_user.id, "post", post_id, payload.reaction_type
        )
        return {
            "active": active,
            "reactions": self._reaction_counts("post", [post_id]).get(post_id),
        }

    def react_to_comment(
        self, current_user: User, comment_id: int, payload: CommunityReactionCreate
    ):
        comment = self.repo.get_comment_by_id(comment_id)
        if not comment or comment.moderation_status != "visible":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
            )
        active = self.repo.toggle_reaction(
            current_user.id, "comment", comment_id, payload.reaction_type
        )
        return {
            "active": active,
            "reactions": self._reaction_counts("comment", [comment_id]).get(comment_id),
        }

    def get_moderation_queue(self, current_user: User, limit: int = 50):
        self._ensure_moderator(current_user)
        return [
            self._serialize_queue_item(item)
            for item in self.repo.get_moderation_queue(limit)
        ]

    def moderate_post(
        self, current_user: User, post_id: int, payload: CommunityModerationUpdate
    ):
        self._ensure_moderator(current_user)
        post = self.repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
            )
        post = self.repo.set_moderation_status(
            post, payload.moderation_status, payload.moderation_reason, current_user.id
        )
        self.repo.mark_reports_reviewed("post", post.id)
        return self._serialize_post(post)

    def moderate_comment(
        self, current_user: User, comment_id: int, payload: CommunityModerationUpdate
    ):
        self._ensure_moderator(current_user)
        comment = self.repo.get_comment_by_id(comment_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
            )
        comment = self.repo.set_moderation_status(
            comment,
            payload.moderation_status,
            payload.moderation_reason,
            current_user.id,
        )
        self.repo.mark_reports_reviewed("comment", comment.id)
        return self._serialize_comment(comment)

    def _auto_review_if_needed(self, obj, content: str, user_id: int):
        lowered = content.lower()
        risky_terms = ("kill myself", "suicide", "self-harm", "hate", "harass")
        if any(term in lowered for term in risky_terms):
            return self.repo.set_moderation_status(
                obj,
                "pending_review",
                "Automatically queued for safety review",
                user_id,
            )
        return obj

    def _normalize_tags(self, tags: list[str]) -> list[str]:
        normalized = []
        for tag in tags:
            value = tag.strip().lower().replace("#", "")[:30]
            if value and value not in normalized:
                normalized.append(value)
        return normalized[:5]

    def _can_manage_content(self, current_user: User, owner_id: int) -> bool:
        return current_user.id == owner_id or is_moderator_or_admin(current_user.role)

    def _ensure_moderator(self, current_user: User) -> None:
        if not is_moderator_or_admin(current_user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Moderator access required",
            )

    def _serialize_post(self, post):
        author = self._serialize_author(post.user, post.is_anonymous)
        comments = post.comments or []
        return {
            "id": post.id,
            "content": post.content,
            "is_anonymous": post.is_anonymous,
            "support_space": post.support_space,
            "topic_tags": post.topic_tags or [],
            "author": author,
            "comments_count": len(
                [
                    comment
                    for comment in comments
                    if comment.moderation_status == "visible"
                ]
            ),
            "reactions": self._reaction_counts("post", [post.id]).get(post.id),
            "reports_count": self._report_counts("post", [post.id]).get(post.id, 0),
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }

    def _serialize_comment(self, comment):
        author = self._serialize_author(comment.user, comment.is_anonymous)
        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "content": comment.content,
            "is_anonymous": comment.is_anonymous,
            "author": author,
            "reactions": self._reaction_counts("comment", [comment.id]).get(comment.id),
            "reports_count": self._report_counts("comment", [comment.id]).get(
                comment.id, 0
            ),
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
        }

    def _serialize_author(self, user: User, is_anonymous: bool) -> dict:
        privacy = user.privacy_preferences or {}
        hide_profile = privacy.get("community_profile_visibility") == "anonymous"
        if is_anonymous or hide_profile:
            return {"id": None, "username": "Anonymous"}
        return {"id": user.id, "username": user.username}

    def _serialize_queue_item(self, item: dict) -> dict:
        obj = item["obj"]
        return {
            "target_type": item["target_type"],
            "target_id": obj.id,
            "content": obj.content,
            "author_username": "Anonymous" if obj.is_anonymous else obj.user.username,
            "is_anonymous": obj.is_anonymous,
            "moderation_status": obj.moderation_status,
            "moderation_reason": obj.moderation_reason,
            "reports_count": item.get("reports_count", 0),
            "latest_report_reason": item.get("latest_report_reason"),
            "created_at": obj.created_at,
        }

    def _reaction_counts(
        self, target_type: str, target_ids: list[int]
    ) -> dict[int, dict[str, int]]:
        counts = self.repo.get_reaction_counts(target_type, target_ids)
        return {
            target_id: counts.get(target_id, self.repo.empty_reactions())
            for target_id in target_ids
        }

    def _report_counts(self, target_type: str, target_ids: list[int]) -> dict[int, int]:
        return self.repo.get_report_counts(target_type, target_ids)
