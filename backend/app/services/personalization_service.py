from collections import Counter, defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.journal import JournalEntry
from app.models.journal_analysis import JournalAnalysis
from app.models.user import User
from app.repo.analytics_repository import AnalyticsRepository
from app.repo.dashboard_repository import DashboardRepository
from app.services.analytics_service import AnalyticsService

ACADEMIC_KEYWORDS = {
    "assignment",
    "class",
    "classes",
    "course",
    "deadline",
    "exam",
    "final",
    "grade",
    "homework",
    "lecture",
    "midterm",
    "paper",
    "professor",
    "project",
    "school",
    "semester",
    "study",
    "studying",
    "test",
    "university",
}

SOCIAL_KEYWORDS = {
    "club",
    "friend",
    "friends",
    "group",
    "party",
    "roommate",
    "social",
    "team",
    "together",
}

STRESS_EMOTIONS = {"stress", "anxiety", "anger", "sadness"}
POSITIVE_EMOTIONS = {"joy", "calm"}
DEFAULT_PRIVACY_PREFERENCES = {
    "journal_private_default": True,
    "anonymous_community_default": False,
    "share_ai_insights": False,
}


class PersonalizationService:
    def __init__(self, db: Session):
        self.db = db
        self.analytics_repo = AnalyticsRepository(db)
        self.analytics_service = AnalyticsService(db)
        self.dashboard_repo = DashboardRepository(db)

    def build_context(self, current_user: User) -> dict:
        summary = self.analytics_repo.get_summary(current_user.id)
        latest_analysis = self.dashboard_repo.get_latest_analysis(current_user.id)
        recent_entries = self._get_recent_entries(current_user.id, limit=30)
        recent_analyses = self._get_recent_analyses(current_user.id, limit=20)

        user_preferences = self._user_preferences(current_user)
        mood_analytics = self.analytics_service.get_mood_analytics(
            current_user=current_user,
            period="30d",
            granularity="day",
        )
        mood_analytics_context = self._mood_analytics_context(
            summary=summary,
            entries=recent_entries,
            analyses=recent_analyses,
            user_id=current_user.id,
            mood_analytics=mood_analytics,
        )
        mood_trend_explanation = self._mood_trend_explanation(recent_entries)

        return {
            "average_mood": summary.get("average_mood"),
            "total_entries": summary.get("total_entries") or 0,
            "latest_emotion": (
                latest_analysis.emotion_label if latest_analysis else None
            ),
            "user_preferences": user_preferences,
            "mood_analytics_context": mood_analytics_context,
            "weekly_summaries": self._weekly_summaries(recent_entries),
            "mood_trend_explanation": mood_trend_explanation,
            "adaptive_prompts": self._adaptive_prompts(recent_entries, recent_analyses),
            "journaling_suggestions": self._journaling_suggestions(
                recent_entries, recent_analyses
            ),
            "follow_up_questions": self._follow_up_questions(
                recent_entries, recent_analyses
            ),
            "pattern_reflections": self._pattern_reflections(
                recent_entries, recent_analyses
            ),
            "ai_insights_timeline": self._ai_insights_timeline(recent_analyses),
        }

    def get_ai_insights(self, current_user: User) -> dict:
        return self.build_context(current_user)

    def _user_preferences(self, current_user: User) -> dict:
        privacy_preferences = {
            **DEFAULT_PRIVACY_PREFERENCES,
            **(current_user.privacy_preferences or {}),
        }
        return {
            "emotional_goals": current_user.emotional_goals or [],
            "preferred_reflection_format": current_user.preferred_reflection_format
            or "diary",
            "reminder_frequency": current_user.reminder_frequency or "none",
            "privacy_preferences": privacy_preferences,
            "ai_tone": current_user.ai_tone or "calm",
            "onboarding_completed": bool(current_user.onboarding_completed),
            "onboarding_skipped": bool(current_user.onboarding_skipped),
        }

    def _mood_analytics_context(
        self,
        summary: dict,
        entries: list[JournalEntry],
        analyses: list[JournalAnalysis],
        user_id: int,
        mood_analytics: dict | None = None,
    ) -> dict:
        active_dates = self.analytics_repo.get_active_dates(user_id)
        streaks = self.analytics_repo.calculate_streaks(active_dates)
        recent_mood_history = [
            {
                "date": entry.created_at.date().isoformat(),
                "mood_score": entry.mood_score,
            }
            for entry in sorted(entries, key=lambda item: item.created_at)[-14:]
        ]
        active_days = len({entry.created_at.date() for entry in entries})
        window_frequency = {
            "entries_count": len(entries),
            "active_days": active_days,
            "average_entries_per_active_day": (
                round(len(entries) / active_days, 2) if active_days else 0
            ),
        }
        analytics_payload = mood_analytics or {}
        return {
            "summary": analytics_payload.get("summary")
            or {
                "total_entries": summary.get("total_entries") or 0,
                "average_mood": summary.get("average_mood"),
                "min_mood": summary.get("min_mood"),
                "max_mood": summary.get("max_mood"),
            },
            "recent_mood_history": recent_mood_history,
            "streaks": analytics_payload.get("streak") or streaks,
            "journaling_frequency": analytics_payload.get("journaling_frequency")
            or window_frequency,
            "journaling_frequency_30_entries_window": window_frequency,
            "top_emotions": analytics_payload.get("top_emotions")
            or self._top_emotions(analyses),
            "correlations": analytics_payload.get("correlations") or [],
        }

    def _get_recent_entries(self, user_id: int, limit: int) -> list[JournalEntry]:
        return (
            self.db.query(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.created_at.desc())
            .limit(limit)
            .all()
        )

    def _get_recent_analyses(self, user_id: int, limit: int) -> list[JournalAnalysis]:
        return (
            self.db.query(JournalAnalysis)
            .join(JournalEntry, JournalAnalysis.journal_entry_id == JournalEntry.id)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalAnalysis.created_at.desc())
            .limit(limit)
            .all()
        )

    def _weekly_summaries(self, entries: list[JournalEntry]) -> list[dict]:
        grouped: dict[date, list[JournalEntry]] = defaultdict(list)
        for entry in entries:
            week_start = entry.created_at.date() - timedelta(
                days=entry.created_at.weekday()
            )
            grouped[week_start].append(entry)

        summaries = []
        for week_start in sorted(grouped.keys(), reverse=True)[:4]:
            week_entries = grouped[week_start]
            average_mood = self._average_mood(week_entries)
            top_tags = self._top_tags(week_entries)
            mood_word = self._mood_word(average_mood)
            theme = (
                ", ".join(top_tags[:3])
                if top_tags
                else "reflection and daily experiences"
            )
            summaries.append(
                {
                    "week_start": week_start.isoformat(),
                    "week_end": (week_start + timedelta(days=6)).isoformat(),
                    "entries_count": len(week_entries),
                    "average_mood": average_mood,
                    "summary": f"This week looked mostly {mood_word}, with recurring attention around {theme}.",
                }
            )

        return summaries

    def _mood_trend_explanation(self, entries: list[JournalEntry]) -> str | None:
        chronological = sorted(entries, key=lambda entry: entry.created_at)
        if len(chronological) < 2:
            return None

        midpoint = max(1, len(chronological) // 2)
        earlier = self._average_mood(chronological[:midpoint])
        later = self._average_mood(chronological[midpoint:])
        if earlier is None or later is None:
            return None

        delta = round(later - earlier, 2)
        if delta >= 0.75:
            return "Your recent entries suggest an upward mood trend compared with earlier entries. Keep noticing what supported that shift."
        if delta <= -0.75:
            return "Your recent entries suggest mood has been lower than earlier in this period. It may help to reduce pressure and add one reliable support."
        return "Your mood has been fairly steady recently, with smaller day-to-day changes rather than a strong upward or downward trend."

    def _adaptive_prompts(
        self, entries: list[JournalEntry], analyses: list[JournalAnalysis]
    ) -> list[str]:
        reflections = self._pattern_reflections(entries, analyses)
        prompts = []
        if self._has_academic_pressure(entries):
            prompts.append(
                "What academic pressure feels most urgent right now, and what is one smaller next step?"
            )
        if self._stressful_monday_count(entries, analyses) >= 2:
            prompts.append(
                "How could you make next Monday feel 10% lighter before it starts?"
            )
        if reflections:
            prompts.append(
                "Which recurring pattern from your recent entries feels most important to understand this week?"
            )
        prompts.append("What helped your mood even slightly since your last entry?")
        return prompts[:4]

    def _journaling_suggestions(
        self, entries: list[JournalEntry], analyses: list[JournalAnalysis]
    ) -> list[str]:
        suggestions = []
        if self._has_academic_pressure(entries):
            suggestions.append(
                "Try a study-pressure check-in: list what is required, what is optional, and what can wait."
            )
        if self._social_mood_lift(entries):
            suggestions.append(
                "Write after social moments to capture which interactions seem to replenish you."
            )
        if self._dominant_stress_emotion(analyses):
            suggestions.append(
                "Use a short evening stress log: trigger, body signal, helpful response, next tiny action."
            )
        suggestions.append(
            "End one entry this week with: 'Tomorrow I can support myself by…'"
        )
        return suggestions[:4]

    def _follow_up_questions(
        self, entries: list[JournalEntry], analyses: list[JournalAnalysis]
    ) -> list[str]:
        questions = []
        latest = analyses[0] if analyses else None
        if latest:
            questions.append(
                f"Your latest entry carried a {latest.emotion_label} tone. What do you think contributed most to it?"
            )
        if self._mood_trend_explanation(entries):
            questions.append(
                "What changed in your routine during the days when your mood shifted?"
            )
        if self._has_academic_pressure(entries):
            questions.append(
                "Which expectation feels external, and which one are you placing on yourself?"
            )
        questions.append(
            "What kind of support would feel realistic today: rest, planning, connection, or movement?"
        )
        return questions[:4]

    def _pattern_reflections(
        self, entries: list[JournalEntry], analyses: list[JournalAnalysis]
    ) -> list[str]:
        reflections = []
        if self._stressful_monday_count(entries, analyses) >= 2:
            reflections.append("You often report stress or lower mood on Mondays.")
        if self._social_mood_lift(entries):
            reflections.append(
                "Your mood tends to improve around entries that mention social activities or connection."
            )
        if self._has_academic_pressure(entries):
            reflections.append(
                "Your entries show recurring academic pressure, especially around workload or deadlines."
            )

        dominant_emotion = self._dominant_stress_emotion(analyses)
        if dominant_emotion:
            reflections.append(
                f"A recurring emotional theme in recent AI analyses is {dominant_emotion}."
            )
        return reflections[:5]

    def _ai_insights_timeline(self, analyses: list[JournalAnalysis]) -> list[dict]:
        timeline = []
        for analysis in analyses:
            title = self._timeline_title(analysis)
            timeline.append(
                {
                    "id": analysis.id,
                    "journal_entry_id": analysis.journal_entry_id,
                    "created_at": analysis.created_at,
                    "emotion_label": analysis.emotion_label,
                    "sentiment_label": analysis.sentiment_label,
                    "title": title,
                    "observation": analysis.short_summary,
                    "recommendation": analysis.recommendation,
                }
            )
        return timeline

    def _timeline_title(self, analysis: JournalAnalysis) -> str:
        if analysis.emotion_label in STRESS_EMOTIONS:
            return f"Noticed recurring {analysis.emotion_label} signals"
        if analysis.emotion_label in POSITIVE_EMOTIONS:
            return f"Captured a {analysis.emotion_label} moment"
        return "Recorded a reflective checkpoint"

    def _average_mood(self, entries: list[JournalEntry]) -> float | None:
        if not entries:
            return None
        return round(sum(entry.mood_score for entry in entries) / len(entries), 2)

    def _top_tags(self, entries: list[JournalEntry]) -> list[str]:
        counter: Counter[str] = Counter()
        for entry in entries:
            for tag in entry.tags or []:
                counter[tag.lower()] += 1
        return [tag for tag, _ in counter.most_common(5)]

    def _mood_word(self, average_mood: float | None) -> str:
        if average_mood is None:
            return "reflective"
        if average_mood >= 4:
            return "positive"
        if average_mood >= 3:
            return "steady"
        if average_mood >= 2:
            return "heavy"
        return "difficult"

    def _entry_text(self, entry: JournalEntry) -> str:
        tags = " ".join(entry.tags or [])
        return f"{entry.title} {entry.content} {tags}".lower()

    def _has_academic_pressure(self, entries: list[JournalEntry]) -> bool:
        matches = 0
        for entry in entries:
            text = self._entry_text(entry)
            if any(keyword in text for keyword in ACADEMIC_KEYWORDS):
                matches += 1
        return matches >= 2

    def _social_mood_lift(self, entries: list[JournalEntry]) -> bool:
        social_moods = []
        other_moods = []
        for entry in entries:
            text = self._entry_text(entry)
            if any(keyword in text for keyword in SOCIAL_KEYWORDS):
                social_moods.append(entry.mood_score)
            else:
                other_moods.append(entry.mood_score)

        if not social_moods or not other_moods:
            return False
        social_average = sum(social_moods) / len(social_moods)
        other_average = sum(other_moods) / len(other_moods)
        return social_average >= other_average + 0.5

    def _stressful_monday_count(
        self, entries: list[JournalEntry], analyses: list[JournalAnalysis]
    ) -> int:
        analysis_by_entry_id = {
            analysis.journal_entry_id: analysis for analysis in analyses
        }
        count = 0
        for entry in entries:
            if entry.created_at.weekday() != 0:
                continue
            analysis = analysis_by_entry_id.get(entry.id)
            if entry.mood_score <= 2 or (
                analysis and analysis.emotion_label in STRESS_EMOTIONS
            ):
                count += 1
        return count

    def _top_emotions(self, analyses: list[JournalAnalysis]) -> list[dict]:
        counter = Counter(
            analysis.emotion_label for analysis in analyses if analysis.emotion_label
        )
        total = sum(counter.values())
        if total == 0:
            return []
        return [
            {
                "emotion_label": emotion,
                "count": count,
                "percentage": round((count / total) * 100, 2),
            }
            for emotion, count in counter.most_common(5)
        ]

    def _dominant_stress_emotion(self, analyses: list[JournalAnalysis]) -> str | None:
        counter = Counter(
            analysis.emotion_label
            for analysis in analyses
            if analysis.emotion_label in STRESS_EMOTIONS
        )
        if not counter:
            return None
        emotion, count = counter.most_common(1)[0]
        return emotion if count >= 2 else None
