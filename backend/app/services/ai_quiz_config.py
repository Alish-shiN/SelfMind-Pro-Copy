from datetime import datetime, timedelta, timezone

QUIZ_TYPES = {
    "stress": {
        "key": "stress",
        "title": "Stress check-in",
        "description": "Reflect on pressure, coping, and recovery in the last few days.",
        "estimated_minutes": 3,
        "emoji": "🌿",
    },
    "burnout": {
        "key": "burnout",
        "title": "Burnout balance",
        "description": "Notice patterns around energy, workload, rest, and capacity.",
        "estimated_minutes": 4,
        "emoji": "🔋",
    },
    "emotional_awareness": {
        "key": "emotional_awareness",
        "title": "Emotional awareness",
        "description": "Practice naming emotions, body cues, and reflection patterns.",
        "estimated_minutes": 3,
        "emoji": "🧭",
    },
    "study_overload": {
        "key": "study_overload",
        "title": "Study overload",
        "description": "Review task load, focus blocks, breaks, and study planning.",
        "estimated_minutes": 3,
        "emoji": "📚",
    },
    "motivation": {
        "key": "motivation",
        "title": "Motivation reset",
        "description": "Explore momentum, quick wins, routines, and achievable next steps.",
        "estimated_minutes": 3,
        "emoji": "✨",
    },
}

LEGACY_QUIZ_TYPE_ALIASES = {
    "stress_reflection": "stress",
}

RECENT_COMPLETION_WINDOW = timedelta(days=7)


def normalize_quiz_type(quiz_type: str | None) -> str:
    key = (quiz_type or "stress").strip().lower().replace("-", "_")
    key = LEGACY_QUIZ_TYPE_ALIASES.get(key, key)
    if key not in QUIZ_TYPES:
        return "stress"
    return key


def quiz_title(quiz_type: str) -> str:
    return QUIZ_TYPES.get(normalize_quiz_type(quiz_type), QUIZ_TYPES["stress"])["title"]


def completed_recently(created_at: datetime | None) -> bool:
    if not created_at:
        return False
    comparison_time = created_at
    if comparison_time.tzinfo is None:
        comparison_time = comparison_time.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - comparison_time <= RECENT_COMPLETION_WINDOW
