from sqlalchemy.orm import Session, joinedload

from app.models.community_comment import CommunityComment
from app.models.community_post import CommunityPost


class CommunityRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_post(self, user_id: int, content: str, is_anonymous: bool) -> CommunityPost:
        post = CommunityPost(
            user_id=user_id,
            content=content,
            is_anonymous=is_anonymous,
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def get_posts(self, limit: int = 20, offset: int = 0) -> list[CommunityPost]:
        return (
            self.db.query(CommunityPost)
            .options(joinedload(CommunityPost.user), joinedload(CommunityPost.comments))
            .order_by(CommunityPost.created_at.desc())
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

    def get_post_by_id_and_user(self, post_id: int, user_id: int) -> CommunityPost | None:
        return (
            self.db.query(CommunityPost)
            .filter(CommunityPost.id == post_id, CommunityPost.user_id == user_id)
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
            .filter(CommunityComment.post_id == post_id)
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

    def get_comment_by_id_and_user(self, comment_id: int, user_id: int) -> CommunityComment | None:
        return (
            self.db.query(CommunityComment)
            .filter(CommunityComment.id == comment_id, CommunityComment.user_id == user_id)
            .first()
        )

    def delete_comment(self, comment: CommunityComment) -> None:
        self.db.delete(comment)
        self.db.commit()