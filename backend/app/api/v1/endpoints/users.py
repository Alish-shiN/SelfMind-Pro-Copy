from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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
from app.models.goal import Goal
from app.models.goal_completion import GoalCompletion
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
EXPORT_OPTIONS = [
    {"type": "journal", "label": "Journal history", "formats": ["json"]},
    {"type": "mood", "label": "Mood history", "formats": ["json"]},
    {"type": "insights", "label": "Personal insights archive", "formats": ["json"]},
    {"type": "full", "label": "Full personal data export", "formats": ["json"]},
    {
        "type": "weekly_report",
        "label": "Weekly reflection report",
        "formats": ["json", "pdf"],
    },
]
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
        "export_options": EXPORT_OPTIONS,
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
    export_type: Literal[
        "full", "journal", "mood", "insights", "weekly_report"
    ] = Query(default="full"),
    file_format: Literal["json", "pdf"] = Query(default="json", alias="format"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file_format == "pdf":
        if export_type != "weekly_report":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF export is currently supported for weekly_report only.",
            )
        report = _weekly_reflection_report(db, current_user)
        return Response(
            content=_weekly_report_pdf(current_user, report),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=selfmind-weekly-report.pdf"
            },
        )

    if export_type == "journal":
        return _journal_export(db, current_user)
    if export_type == "mood":
        return _mood_export(db, current_user)
    if export_type == "insights":
        return _insights_export(db, current_user)
    if export_type == "weekly_report":
        return _weekly_reflection_report(db, current_user)
    return _full_export(db, current_user)


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


def _export_header(export_type: str) -> dict:
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "export_type": export_type,
        "notice": "Export includes sensitive-like emotional data. Store it somewhere private.",
    }


def _journal_export(db: Session, user: User) -> dict:
    return {
        **_export_header("journal"),
        "journal_entries": [
            {
                **_model_dict(entry),
                "analysis": _model_dict(entry.analysis) if entry.analysis else None,
            }
            for entry in _journal_entries(db, user.id)
        ],
    }


def _mood_export(db: Session, user: User) -> dict:
    entries = _journal_entries(db, user.id)
    history = [
        {
            "journal_entry_id": entry.id,
            "date": entry.created_at.date().isoformat(),
            "mood_score": entry.mood_score,
            "emotion_label": entry.analysis.emotion_label if entry.analysis else None,
            "sentiment_label": (
                entry.analysis.sentiment_label if entry.analysis else None
            ),
        }
        for entry in entries
    ]
    mood_scores = [entry.mood_score for entry in entries]
    return {
        **_export_header("mood"),
        "summary": {
            "entries_count": len(entries),
            "average_mood": (
                round(sum(mood_scores) / len(mood_scores), 2) if mood_scores else None
            ),
            "min_mood": min(mood_scores) if mood_scores else None,
            "max_mood": max(mood_scores) if mood_scores else None,
        },
        "mood_history": history,
    }


def _insights_export(db: Session, user: User) -> dict:
    return {
        **_export_header("insights"),
        "journal_insights": [
            _model_dict(entry.analysis)
            for entry in _journal_entries(db, user.id)
            if entry.analysis
        ],
        "ai_quiz_results": [
            {
                **_model_dict(session),
                "answers": [_model_dict(answer) for answer in session.answers],
                "result": _model_dict(session.result) if session.result else None,
            }
            for session in _quiz_sessions(db, user.id)
        ],
        "chat_sessions": [
            {
                **_model_dict(session),
                "messages": [_model_dict(message) for message in session.messages],
            }
            for session in _chat_sessions(db, user.id)
        ],
    }


def _full_export(db: Session, user: User) -> dict:
    journal_export = _journal_export(db, user)
    insights_export = _insights_export(db, user)
    mood_export = _mood_export(db, user)
    return {
        **_export_header("full"),
        "account": _model_dict(
            user,
            exclude={"hashed_password"},
        ),
        "profile": _model_dict(user.profile) if user.profile else None,
        "preferences": _serialize_preferences(user),
        "journal_entries": journal_export["journal_entries"],
        "journal_export": journal_export,
        "mood_export": mood_export,
        "journal_insights": insights_export["journal_insights"],
        "ai_quiz_sessions": insights_export["ai_quiz_results"],
        "ai_quiz_results": insights_export["ai_quiz_results"],
        "chat_sessions": insights_export["chat_sessions"],
        "insights_export": insights_export,
        "goals": _goals_export(db, user),
        "community": {
            "posts": [_model_dict(post) for post in _community_posts(db, user.id)],
            "comments": [
                _model_dict(comment) for comment in _community_comments(db, user.id)
            ],
            "reactions": [
                _model_dict(reaction) for reaction in _community_reactions(db, user.id)
            ],
            "reports_submitted": [
                _model_dict(report) for report in _community_reports(db, user.id)
            ],
        },
        "reminder_preferences": [
            _model_dict(preference)
            for preference in db.query(ReminderPreference)
            .filter(ReminderPreference.user_id == user.id)
            .all()
        ],
        "safety_flags": [
            _model_dict(flag)
            for flag in db.query(SafetyFlag).filter(SafetyFlag.user_id == user.id).all()
        ],
    }


def _weekly_reflection_report(db: Session, user: User) -> dict:
    end_date = date.today()
    start_date = end_date - timedelta(days=6)
    entries = [
        entry
        for entry in _journal_entries(db, user.id)
        if start_date <= entry.created_at.date() <= end_date
    ]
    if len(entries) < 2:
        return {
            **_export_header("weekly_report"),
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "has_enough_data": False,
            "fallback_message": "Not enough journal data for a weekly reflection yet. Add at least two entries this week to generate patterns and suggestions.",
            "mood_overview": None,
            "emotional_patterns": [],
            "reflection_summary": None,
            "suggested_focus_next_week": "Try adding two short check-ins next week: one mood note and one reflection about what supported you.",
        }

    chronological = sorted(entries, key=lambda entry: entry.created_at)
    mood_scores = [entry.mood_score for entry in chronological]
    emotions = [
        entry.analysis.emotion_label
        for entry in chronological
        if entry.analysis and entry.analysis.emotion_label
    ]
    emotion_counts = Counter(emotions)
    top_patterns = [
        {"emotion_label": emotion, "count": count}
        for emotion, count in emotion_counts.most_common(5)
    ]
    avg_mood = round(sum(mood_scores) / len(mood_scores), 2)
    mood_delta = mood_scores[-1] - mood_scores[0]
    trend = "steady"
    if mood_delta >= 2:
        trend = "improving"
    elif mood_delta <= -2:
        trend = "declining"
    top_emotion = top_patterns[0]["emotion_label"] if top_patterns else "mixed emotions"

    return {
        **_export_header("weekly_report"),
        "date_range": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "has_enough_data": True,
        "fallback_message": None,
        "mood_overview": {
            "entries_count": len(entries),
            "average_mood": avg_mood,
            "min_mood": min(mood_scores),
            "max_mood": max(mood_scores),
            "trend": trend,
        },
        "emotional_patterns": top_patterns,
        "reflection_summary": f"You wrote {len(entries)} entries this week. Your average mood was {avg_mood}/10, with a mostly {trend} pattern and recurring signals around {top_emotion}.",
        "suggested_focus_next_week": _suggested_weekly_focus(
            avg_mood, top_emotion, trend
        ),
        "insights_summary": [
            {
                "journal_entry_id": entry.id,
                "emotion_label": entry.analysis.emotion_label,
                "sentiment_label": entry.analysis.sentiment_label,
                "summary": entry.analysis.short_summary,
                "recommendation": entry.analysis.recommendation,
            }
            for entry in chronological
            if entry.analysis
        ],
    }


def _suggested_weekly_focus(average_mood: float, top_emotion: str, trend: str) -> str:
    if average_mood <= 4 or trend == "declining":
        return "Prioritize gentle routines, lower-pressure planning, and one supportive connection you can rely on."
    if top_emotion in {"stress", "anxiety", "anger", "sadness"}:
        return "Track what triggers that emotion and pair each note with one small recovery action."
    return "Keep noticing which routines support steadiness, and write one short gratitude or energy check-in after those moments."


def _weekly_report_pdf(user: User, report: dict) -> bytes:
    date_range = report["date_range"]
    mood = report.get("mood_overview") or {}
    lines = [
        "SelfMind Pro Weekly Reflection Report",
        f"User: {user.username if user.username else 'Anonymous'}",
        f"Date range: {date_range['start_date']} to {date_range['end_date']}",
        "",
        "Mood summary:",
        report.get("fallback_message")
        or f"Average mood {mood.get('average_mood')}/10 across {mood.get('entries_count')} entries. Trend: {mood.get('trend')}.",
        "",
        "Journal summary:",
        report.get("reflection_summary")
        or "More journal entries are needed for a weekly summary.",
        "",
        "AI insights summary:",
    ]
    insights = report.get("insights_summary") or []
    if insights:
        lines.extend(
            f"- {item['emotion_label']}: {item['summary']}" for item in insights[:6]
        )
    else:
        lines.append("No AI insight summaries available for this period.")
    lines.extend(
        [
            "",
            "Suggested focus for next week:",
            report.get("suggested_focus_next_week")
            or "Add a few brief mood check-ins.",
            "",
            "Disclaimer: This report is for reflection and is not medical advice, diagnosis, or treatment.",
        ]
    )
    return _simple_pdf(lines)


def _simple_pdf(lines: list[str]) -> bytes:
    wrapped = []
    for line in lines:
        if not line:
            wrapped.append("")
            continue
        while len(line) > 92:
            wrapped.append(line[:92])
            line = line[92:]
        wrapped.append(line)

    y = 760
    text_ops = ["BT", "/F1 11 Tf", "50 780 Td"]
    previous_y = 780
    for line in wrapped[:48]:
        y -= 15
        text_ops.append(f"0 -{previous_y - y} Td ({_pdf_escape(line)}) Tj")
        previous_y = y
    text_ops.append("ET")
    stream = "\n".join(text_ops).encode("latin-1", errors="replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(stream)).encode()
        + b" >>\nstream\n"
        + stream
        + b"\nendstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(pdf)


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


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


def _goals_export(db: Session, user: User) -> dict:
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == user.id)
        .order_by(Goal.created_at.desc())
        .all()
    )
    return {
        "goals": [_model_dict(goal) for goal in goals],
        "completions": [
            _model_dict(completion)
            for completion in db.query(GoalCompletion)
            .filter(GoalCompletion.user_id == user.id)
            .order_by(GoalCompletion.created_at.desc())
            .all()
        ],
    }


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
