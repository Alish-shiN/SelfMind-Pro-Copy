from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.community_repository import CommunityRepository
from app.schemas.community import CommunityCommentCreate, CommunityPostCreate


class CommunityService:
    def __init__(self, db: Session):
        self.repo = CommunityRepository(db)

    def create_post(self, current_user: User, payload: CommunityPostCreate):
        post = self.repo.create_post(
            user_id=current_user.id,
            content=payload.content,
            is_anonymous=payload.is_anonymous,
        )
        return self._serialize_post(post)

    def get_feed(self, limit: int = 20, offset: int = 0):
        posts = self.repo.get_posts(limit=limit, offset=offset)
        return [self._serialize_post(post) for post in posts]

    def get_post_detail(self, post_id: int):
        post = self.repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        comments = [self._serialize_comment(comment) for comment in post.comments]

        return {
            **self._serialize_post(post),
            "comments": comments,
        }

    def delete_post(self, current_user: User, post_id: int):
        post = self.repo.get_post_by_id_and_user(post_id, current_user.id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found or access denied"
            )

        self.repo.delete_post(post)
        return {"message": "Post deleted successfully"}

    def create_comment(self, current_user: User, post_id: int, payload: CommunityCommentCreate):
        post = self.repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        comment = self.repo.create_comment(
            post_id=post_id,
            user_id=current_user.id,
            content=payload.content,
            is_anonymous=payload.is_anonymous,
        )

        comment = self.repo.get_comment_by_id(comment.id)
        return self._serialize_comment(comment)

    def get_comments(self, post_id: int):
        post = self.repo.get_post_by_id(post_id)
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found"
            )

        comments = self.repo.get_comments_by_post_id(post_id)
        return [self._serialize_comment(comment) for comment in comments]

    def delete_comment(self, current_user: User, comment_id: int):
        comment = self.repo.get_comment_by_id_and_user(comment_id, current_user.id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found or access denied"
            )

        self.repo.delete_comment(comment)
        return {"message": "Comment deleted successfully"}

    def _serialize_post(self, post):
        author = {
            "id": None if post.is_anonymous else post.user.id,
            "username": "Anonymous" if post.is_anonymous else post.user.username,
        }

        return {
            "id": post.id,
            "content": post.content,
            "is_anonymous": post.is_anonymous,
            "author": author,
            "comments_count": len(post.comments) if post.comments is not None else 0,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
        }

    def _serialize_comment(self, comment):
        author = {
            "id": None if comment.is_anonymous else comment.user.id,
            "username": "Anonymous" if comment.is_anonymous else comment.user.username,
        }

        return {
            "id": comment.id,
            "post_id": comment.post_id,
            "content": comment.content,
            "is_anonymous": comment.is_anonymous,
            "author": author,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at,
        }