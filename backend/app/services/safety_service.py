from sqlalchemy.orm import Session

from app.models.safety_flag import SafetyFlag
from app.models.user import User
from app.schemas.safety import SafetyCheckRequest

CRISIS_SIGNALS = {
    "suicide": "crisis",
    "kill myself": "crisis",
    "end my life": "crisis",
    "self harm": "high",
    "self-harm": "high",
    "harm myself": "high",
    "i want to die": "crisis",
    "don't want to live": "crisis",
    "do not want to live": "crisis",
    "can't go on": "high",
    "cannot go on": "high",
    "hopeless": "medium",
    "покончить с собой": "crisis",
    "суицид": "crisis",
    "самоубий": "crisis",
    "умереть": "high",
    "не хочу жить": "crisis",
    "нет сил": "medium",
}

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "crisis": 4}

CRISIS_RESOURCES = [
    {
        "title": "988 Suicide & Crisis Lifeline",
        "description": "Call or text 988 if you or someone nearby may be in immediate emotional crisis.",
        "action_label": "Call or text 988",
        "action_value": "988",
        "country": "US",
    },
    {
        "title": "Emergency services",
        "description": "If there is immediate danger, contact local emergency services now.",
        "action_label": "Call 112",
        "action_value": "112",
        "country": "US",
    },
    {
        "title": "Trusted person",
        "description": "Reach out to a trusted friend, family member, mentor, or campus support contact.",
        "action_label": "Contact someone you trust",
        "action_value": "trusted_person",
        "country": "US",
    },
]

SAFETY_MESSAGE = (
    "This looks serious. SelfMind Pro is not emergency care. "
    "If you may hurt yourself or someone else, call emergency services or a crisis hotline now."
)


class SafetyService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_text(self, text: str, mood_score: int | None = None) -> tuple[list[str], str | None]:
        lowered = text.lower()
        matched = [signal for signal in CRISIS_SIGNALS if signal in lowered]

        if mood_score is not None:
            if mood_score <= 1:
                matched.append("mood_score:1")
            elif mood_score <= 2:
                matched.append("mood_score:2")

        if not matched:
            return [], None

        severities = [CRISIS_SIGNALS[signal] for signal in matched if signal in CRISIS_SIGNALS]
        if "mood_score:1" in matched:
            severities.append("crisis")
        elif "mood_score:2" in matched:
            severities.append("high")

        severity = max(severities, key=lambda value: SEVERITY_RANK[value])
        return matched, severity

    def flag_if_needed(
        self,
        current_user: User | None,
        source_type: str,
        source_id: int | None,
        text: str,
        mood_score: int | None = None,
    ) -> SafetyFlag | None:
        matched, severity = self.analyze_text(text, mood_score=mood_score)
        if not matched or severity is None:
            return None

        flag = SafetyFlag(
            user_id=current_user.id if current_user else None,
            source_type=source_type,
            source_id=source_id,
            severity=severity,
            status="open",
            matched_signals=matched,
            content_excerpt=text[:500],
        )
        self.db.add(flag)
        self.db.commit()
        self.db.refresh(flag)
        return flag

    def check_text(self, payload: SafetyCheckRequest) -> dict:
        matched, severity = self.analyze_text(payload.text, mood_score=payload.mood_score)
        return {
            "is_flagged": bool(matched),
            "severity": severity,
            "matched_signals": matched,
            "message": SAFETY_MESSAGE if matched else None,
        }

    def get_my_flags(self, current_user: User) -> list[SafetyFlag]:
        return (
            self.db.query(SafetyFlag)
            .filter(SafetyFlag.user_id == current_user.id)
            .order_by(SafetyFlag.created_at.desc())
            .all()
        )

    def get_resources(self) -> list[dict]:
        return CRISIS_RESOURCES
