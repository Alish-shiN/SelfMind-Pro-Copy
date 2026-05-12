from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.ai_quiz_session import AIQuizSession
from app.models.chat_session import ChatSession
from app.models.community_comment import CommunityComment
from app.models.community_post import CommunityPost
from app.models.community_reaction import CommunityReaction
from app.models.community_report import CommunityReport
from app.models.journal import JournalEntry
from app.models.reminder_preference import ReminderPreference
from app.models.safety_flag import SafetyFlag
from app.models.user import User
from app.schemas.user import (
    PrivacyCenterResponse,
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserResponse,
)

router = APIRouter(prefix="/users", tags=["users"])

PRIVACY_NOTICE_VERSION = "2026-05-privacy-center-v1"
DEFAULT_PRIVACY = {
    "journal_private_default": True,
    "anonymous_community_default": False,
    "share_ai_insights": False,
    "community_profile_visibility": "members",
    "ai_processing_consent": False,
    "privacy_notice_accepted": False,
    "privacy_notice_version": None,
    "privacy_notice_accepted_at": None,
}
PRIVACY_NOTICE = {
    "title": "SelfMind Pro Privacy Center",
    "summary": "We treat emotional data as sensitive-like data and keep privacy controls close to your journaling and community experience.",
    "emotional_data_notice": "Journal entries, mood scores, detected emotions, AI reflections, quiz answers, chat messages, and safety signals can reveal sensitive mental and emotional patterns. SelfMind Pro uses them only to provide journaling, analytics, safety, reminders, and personalized AI features.",
    "ai_processing": [
        "AI features process your journal text, mood metadata, chat messages, quiz answers, emotional goals, and selected preferences when you ask for analysis, chat, quizzes, or personalized insights.",
        "Stored AI outputs may include sentiment labels, emotion labels, summaries, recommendations, quiz results, and insight timelines so you can revisit them later.",
        "Community posts and comments are separate from private journal entries; anonymous posting hides your display identity from other members but moderation and safety systems still retain account linkage.",
    ],
    "stored_data": [
        "Account profile: email, username, role, profile metadata, and onboarding/privacy preferences.",
        "Journal data: entries, mood scores, tags, privacy flags, reminders, and AI journal analysis.",
        "AI data: chat sessions/messages, quiz sessions/answers/results, and personalization context derived from your entries.",
        "Community data: posts, comments, reports, reactions, moderation state, support spaces, and topic tags.",
        "Safety/reminder data: safety flags, notification preferences, push token metadata, and timestamps.",
    ],
    "controls": [
        "Choose whether new journal entries default to private or public.",
        "Choose whether community posts default to anonymous and how visible your community profile should be.",
        "Choose whether AI insights can be reused for personalization.",
        "Export a copy of your account data at any time.",
        "Delete your account and associated user data when you no longer want to use SelfMind Pro.",
    ],
}


class DeleteAccountRequest(BaseModel):
    confirmation: str = Field(..., min_length=6)


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_my_preferences(current_user: User = Depends(get_current_user)):
    return _serialize_preferences(current_user)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
def update_my_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if field == "emotional_goals":
                value = _normalize_goals(value)
            if field == "privacy_preferences":
                value = _normalize_privacy_preferences(value)
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return _serialize_preferences(current_user)


@router.get("/me/privacy-center", response_model=PrivacyCenterResponse)
def get_privacy_center(current_user: User = Depends(get_current_user)):
    preferences = _serialize_preferences(current_user)
    return {
        "notice_version": PRIVACY_NOTICE_VERSION,
        "notice": PRIVACY_NOTICE,
        "preferences": preferences,
    }


@router.post("/me/privacy-notice/accept", response_model=UserPreferencesResponse)
def accept_privacy_notice(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    privacy = _serialize_privacy_preferences(current_user)
    privacy.update(
        {
            "ai_processing_consent": True,
            "privacy_notice_accepted": True,
            "privacy_notice_version": PRIVACY_NOTICE_VERSION,
            "privacy_notice_accepted_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    current_user.privacy_preferences = privacy
    db.commit()
    db.refresh(current_user)
    return _serialize_preferences(current_user)


@router.get("/me/export")
def export_my_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "notice": "Export includes sensitive-like emotional data. Store it somewhere private.",
        "account": _model_dict(
            current_user,
            exclude={"hashed_password"},
        ),
        "profile": _model_dict(current_user.profile) if current_user.profile else None,
        "preferences": _serialize_preferences(current_user),
        "journal_entries": [
            {
                **_model_dict(entry),
                "analysis": _model_dict(entry.analysis) if entry.analysis else None,
            }
            for entry in _journal_entries(db, current_user.id)
        ],
        "chat_sessions": [
            {
                **_model_dict(session),
                "messages": [_model_dict(message) for message in session.messages],
            }
            for session in _chat_sessions(db, current_user.id)
        ],
        "ai_quiz_sessions": [
            {
                **_model_dict(session),
                "answers": [_model_dict(answer) for answer in session.answers],
                "result": _model_dict(session.result) if session.result else None,
            }
            for session in _quiz_sessions(db, current_user.id)
        ],
        "community": {
            "posts": [
                _model_dict(post) for post in _community_posts(db, current_user.id)
            ],
            "comments": [
                _model_dict(comment)
                for comment in _community_comments(db, current_user.id)
            ],
            "reactions": [
                _model_dict(reaction)
                for reaction in _community_reactions(db, current_user.id)
            ],
            "reports_submitted": [
                _model_dict(report)
                for report in _community_reports(db, current_user.id)
            ],
        },
        "reminder_preferences": [
            _model_dict(preference)
            for preference in db.query(ReminderPreference)
            .filter(ReminderPreference.user_id == current_user.id)
            .all()
        ],
        "safety_flags": [
            _model_dict(flag)
            for flag in db.query(SafetyFlag)
            .filter(SafetyFlag.user_id == current_user.id)
            .all()
        ],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.confirmation.strip().lower() != "delete":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type DELETE to confirm account deletion.",
        )

    _delete_owned_data(db, current_user)
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _serialize_preferences(user: User) -> dict:
    privacy = _serialize_privacy_preferences(user)
    return {
        "emotional_goals": user.emotional_goals or [],
        "preferred_reflection_format": user.preferred_reflection_format or "diary",
        "reminder_frequency": user.reminder_frequency or "none",
        "privacy_preferences": privacy,
        "ai_tone": user.ai_tone or "calm",
        "onboarding_completed": bool(user.onboarding_completed),
        "onboarding_skipped": bool(user.onboarding_skipped),
    }


def _serialize_privacy_preferences(user: User) -> dict:
    return _normalize_privacy_preferences(user.privacy_preferences or {})


def _normalize_privacy_preferences(value: dict) -> dict:
    privacy = {**DEFAULT_PRIVACY, **value}
    visibility = privacy.get("community_profile_visibility")
    if visibility not in {"anonymous", "members", "public"}:
        privacy["community_profile_visibility"] = "members"
    return privacy


def _normalize_goals(goals: list[str]) -> list[str]:
    normalized = []
    for goal in goals:
        value = goal.strip().lower()[:60]
        if value and value not in normalized:
            normalized.append(value)
    return normalized[:8]


def _model_dict(model: Any, exclude: set[str] | None = None) -> dict:
    exclude = exclude or set()
    return jsonable_encoder(
        {
            column.name: getattr(model, column.name)
            for column in model.__table__.columns
            if column.name not in exclude
        }
    )


def _journal_entries(db: Session, user_id: int) -> list[JournalEntry]:
    return (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.created_at.desc())
        .all()
    )


def _chat_sessions(db: Session, user_id: int) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )


def _quiz_sessions(db: Session, user_id: int) -> list[AIQuizSession]:
    return (
        db.query(AIQuizSession)
        .filter(AIQuizSession.user_id == user_id)
        .order_by(AIQuizSession.created_at.desc())
        .all()
    )


def _community_posts(db: Session, user_id: int) -> list[CommunityPost]:
    return (
        db.query(CommunityPost)
        .filter(CommunityPost.user_id == user_id)
        .order_by(CommunityPost.created_at.desc())
        .all()
    )


def _community_comments(db: Session, user_id: int) -> list[CommunityComment]:
    return (
        db.query(CommunityComment)
        .filter(CommunityComment.user_id == user_id)
        .order_by(CommunityComment.created_at.desc())
        .all()
    )


def _community_reactions(db: Session, user_id: int) -> list[CommunityReaction]:
    return (
        db.query(CommunityReaction)
        .filter(CommunityReaction.user_id == user_id)
        .order_by(CommunityReaction.created_at.desc())
        .all()
    )


def _community_reports(db: Session, user_id: int) -> list[CommunityReport]:
    return (
        db.query(CommunityReport)
        .filter(CommunityReport.reporter_user_id == user_id)
        .order_by(CommunityReport.created_at.desc())
        .all()
    )


def _delete_owned_data(db: Session, user: User) -> None:
    post_ids = [post.id for post in _community_posts(db, user.id)]
    comment_ids = [comment.id for comment in _community_comments(db, user.id)]
    if post_ids:
        comment_ids.extend(
            comment.id
            for comment in db.query(CommunityComment.id)
            .filter(CommunityComment.post_id.in_(post_ids))
            .all()
        )
    comment_ids = list(dict.fromkeys(comment_ids))

    if post_ids:
        db.query(CommunityReaction).filter(
            CommunityReaction.target_type == "post",
            CommunityReaction.target_id.in_(post_ids),
        ).delete(synchronize_session=False)
        db.query(CommunityReport).filter(
            CommunityReport.target_type == "post",
            CommunityReport.target_id.in_(post_ids),
        ).delete(synchronize_session=False)

    if comment_ids:
        db.query(CommunityReaction).filter(
            CommunityReaction.target_type == "comment",
            CommunityReaction.target_id.in_(comment_ids),
        ).delete(synchronize_session=False)
        db.query(CommunityReport).filter(
            CommunityReport.target_type == "comment",
            CommunityReport.target_id.in_(comment_ids),
        ).delete(synchronize_session=False)

    db.query(CommunityReaction).filter(CommunityReaction.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(CommunityReport).filter(
        CommunityReport.reporter_user_id == user.id
    ).delete(synchronize_session=False)
    db.query(SafetyFlag).filter(SafetyFlag.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(ReminderPreference).filter(ReminderPreference.user_id == user.id).delete(
        synchronize_session=False
    )
