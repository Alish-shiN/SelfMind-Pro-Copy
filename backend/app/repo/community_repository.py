from collections import Counter

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.community_comment import CommunityComment
from app.models.community_post import CommunityPost
from app.models.community_reaction import CommunityReaction
from app.models.community_report import CommunityReport

REACTION_TYPES = ("support", "me_too", "sending_strength", "helpful")


class CommunityRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_post(
        self,
        user_id: int,
        content: str,
        is_anonymous: bool,
        support_space: str,
        topic_tags: list[str] | None,
    ) -> CommunityPost:
        post = CommunityPost(
            user_id=user_id,
            content=content,
            is_anonymous=is_anonymous,
            support_space=support_space,
            topic_tags=topic_tags or [],
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def get_posts(
        self,
        limit: int = 20,
        offset: int = 0,
        support_space: str | None = None,
        topic_tag: str | None = None,
    ) -> list[CommunityPost]:
        query = (
            self.db.query(CommunityPost)
            .options(joinedload(CommunityPost.user), joinedload(CommunityPost.comments))
            .filter(CommunityPost.moderation_status == "visible")
        )
        if support_space:
            query = query.filter(CommunityPost.support_space == support_space)
        if topic_tag:
            query = query.filter(CommunityPost.topic_tags.any(topic_tag.lower()))
        return (
            query.order_by(CommunityPost.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_post_by_id(self, post_id: int) -> CommunityPost | None:
        return (
            self.db.query(CommunityPost)
            .options(
                joinedload(CommunityPost.user),
                joinedload(CommunityPost.comments).joinedload(CommunityComment.user),
            )
            .filter(CommunityPost.id == post_id)
            .first()
        )

    def delete_post(self, post: CommunityPost) -> None:
        self.db.delete(post)
        self.db.commit()

    def create_comment(
        self,
        post_id: int,
        user_id: int,
        content: str,
        is_anonymous: bool,
    ) -> CommunityComment:
        comment = CommunityComment(
            post_id=post_id,
            user_id=user_id,
            content=content,
            is_anonymous=is_anonymous,
        )
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def get_comments_by_post_id(self, post_id: int) -> list[CommunityComment]:
        return (
            self.db.query(CommunityComment)
            .options(joinedload(CommunityComment.user))
            .filter(
                CommunityComment.post_id == post_id,
                CommunityComment.moderation_status == "visible",
            )
            .order_by(CommunityComment.created_at.asc())
            .all()
        )

    def get_comment_by_id(self, comment_id: int) -> CommunityComment | None:
        return (
            self.db.query(CommunityComment)
            .options(joinedload(CommunityComment.user))
            .filter(CommunityComment.id == comment_id)
            .first()
        )

    def delete_comment(self, comment: CommunityComment) -> None:
        self.db.delete(comment)
        self.db.commit()

    def create_report(
        self,
        reporter_user_id: int,
        target_type: str,
        target_id: int,
        reason: str,
        details: str | None,
    ) -> CommunityReport:
        report = CommunityReport(
            reporter_user_id=reporter_user_id,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            details=details,
            status="open",
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def set_moderation_status(
        self,
        obj,
        moderation_status: str,
        moderation_reason: str | None,
        moderated_by_user_id: int | None,
    ):
        from datetime import datetime, timezone

        obj.moderation_status = moderation_status
        obj.moderation_reason = moderation_reason
        obj.moderated_at = datetime.now(timezone.utc)
        obj.moderated_by_user_id = moderated_by_user_id
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def toggle_reaction(
        self,
        user_id: int,
        target_type: str,
        target_id: int,
        reaction_type: str,
    ) -> bool:
        existing = (
            self.db.query(CommunityReaction)
            .filter(
                CommunityReaction.user_id == user_id,
                CommunityReaction.target_type == target_type,
                CommunityReaction.target_id == target_id,
                CommunityReaction.reaction_type == reaction_type,
            )
            .first()
        )
        if existing:
            self.db.delete(existing)
            self.db.commit()
            return False

        reaction = CommunityReaction(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
            reaction_type=reaction_type,
        )
        self.db.add(reaction)
        self.db.commit()
        return True

    def get_reaction_counts(
        self, target_type: str, target_ids: list[int]
    ) -> dict[int, dict[str, int]]:
        if not target_ids:
            return {}
        rows = (
            self.db.query(
                CommunityReaction.target_id,
                CommunityReaction.reaction_type,
                func.count(CommunityReaction.id).label("count"),
            )
            .filter(
                CommunityReaction.target_type == target_type,
                CommunityReaction.target_id.in_(target_ids),
            )
            .group_by(CommunityReaction.target_id, CommunityReaction.reaction_type)
            .all()
        )
        result = {target_id: self.empty_reactions() for target_id in target_ids}
        for target_id, reaction_type, count in rows:
            result[target_id][reaction_type] = count
        return result

    def get_report_counts(
        self, target_type: str, target_ids: list[int]
    ) -> dict[int, int]:
        if not target_ids:
            return {}
        rows = (
            self.db.query(
                CommunityReport.target_id, func.count(CommunityReport.id).label("count")
            )
            .filter(
                CommunityReport.target_type == target_type,
                CommunityReport.target_id.in_(target_ids),
                CommunityReport.status == "open",
            )
            .group_by(CommunityReport.target_id)
            .all()
        )
        return {target_id: count for target_id, count in rows}

    def get_moderation_queue(self, limit: int = 50) -> list[dict]:
        post_report_counts = self.get_report_counts_for_queue("post")
        comment_report_counts = self.get_report_counts_for_queue("comment")
        posts = (
            self.db.query(CommunityPost)
            .options(joinedload(CommunityPost.user))
            .filter(CommunityPost.moderation_status == "pending_review")
            .order_by(CommunityPost.updated_at.desc())
            .limit(limit)
            .all()
        )
        comments = (
            self.db.query(CommunityComment)
            .options(joinedload(CommunityComment.user))
            .filter(CommunityComment.moderation_status == "pending_review")
            .order_by(CommunityComment.updated_at.desc())
            .limit(limit)
            .all()
        )
        items = []
        for post in posts:
            items.append(
                {
                    "target_type": "post",
                    "obj": post,
                    **post_report_counts.get(post.id, {}),
                }
            )
        for comment in comments:
            items.append(
                {
                    "target_type": "comment",
                    "obj": comment,
                    **comment_report_counts.get(comment.id, {}),
                }
            )
        return sorted(items, key=lambda item: item["obj"].updated_at, reverse=True)[
            :limit
        ]

    def get_report_counts_for_queue(self, target_type: str) -> dict[int, dict]:
        reports = (
            self.db.query(CommunityReport)
            .filter(
                CommunityReport.target_type == target_type,
                CommunityReport.status == "open",
            )
            .order_by(CommunityReport.created_at.desc())
            .all()
        )
        grouped: dict[int, list[CommunityReport]] = {}
        for report in reports:
            grouped.setdefault(report.target_id, []).append(report)
        return {
            target_id: {
                "reports_count": len(items),
                "latest_report_reason": items[0].reason if items else None,
            }
            for target_id, items in grouped.items()
        }

    def mark_reports_reviewed(self, target_type: str, target_id: int) -> None:
        self.db.query(CommunityReport).filter(
            CommunityReport.target_type == target_type,
            CommunityReport.target_id == target_id,
            CommunityReport.status == "open",
        ).update({"status": "reviewed"})
        self.db.commit()

    def empty_reactions(self) -> dict[str, int]:
        return dict(Counter({reaction_type: 0 for reaction_type in REACTION_TYPES}))
