from collections import Counter, defaultdict
from datetime import date, timedelta
from math import sqrt

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_quiz_result import AIQuizResult
from app.models.journal import JournalEntry
from app.models.user import User
from app.repo.analytics_repository import AnalyticsRepository

PERIOD_DAYS = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 183,
    "1y": 365,
}
SEVERITY_SCORE = {"low": 1, "moderate": 2, "elevated": 3, "high": 4}


class AnalyticsService:
    def __init__(self, db: Session):
        self.repo = AnalyticsRepository(db)

    def get_journal_analytics(self, current_user: User):
        summary = self.repo.get_summary(current_user.id)
        mood_history = self.repo.get_mood_history(current_user.id)

        return {
            "summary": summary,
            "mood_history": mood_history,
        }

    def get_recent_entries(self, current_user: User, limit: int = 5):
        return self.repo.get_recent_entries(current_user.id, limit)

    def get_streak(self, current_user: User):
        active_dates = self.repo.get_active_dates(current_user.id)
        return self.repo.calculate_streaks(active_dates)

    def get_mood_analytics(
        self,
        current_user: User,
        period: str = "30d",
        granularity: str = "day",
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        start_date, end_date = self._resolve_date_range(period, start_date, end_date)
        entries = self.repo.get_entries_for_period(
            current_user.id, start_date, end_date
        )
        quiz_results = self.repo.get_quiz_results_for_period(
            current_user.id, start_date, end_date
        )
        active_dates = self.repo.get_active_dates(current_user.id, start_date, end_date)

        summary = self.repo.get_summary(current_user.id, start_date, end_date)
        mood_history = self._build_mood_history(
            entries, start_date, end_date, granularity
        )
        top_emotions = self._top_emotions(entries)
        frequency = self._journaling_frequency(entries, start_date, end_date)
        streak = self.repo.calculate_streaks(active_dates)
        streak_calendar = self._streak_calendar(entries, start_date, end_date)
        correlations = self._correlations(mood_history, quiz_results, granularity)
        emotion_heatmap = self._emotion_heatmap(entries, start_date, end_date)
        insights = self._insights(
            summary, mood_history, top_emotions, frequency, correlations
        )

        return {
            "period": period,
            "granularity": granularity,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "summary": summary,
            "mood_history": mood_history,
            "top_emotions": top_emotions,
            "journaling_frequency": frequency,
            "streak": streak,
            "streak_calendar": streak_calendar,
            "correlations": correlations,
            "emotion_heatmap": emotion_heatmap,
            "insights": insights,
        }

    def _resolve_date_range(
        self,
        period: str,
        start_date: date | None,
        end_date: date | None,
    ) -> tuple[date, date]:
        resolved_end = end_date or date.today()
        if start_date:
            resolved_start = start_date
        else:
            days = PERIOD_DAYS.get(period)
            if days is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="period must be one of: 7d, 30d, 90d, 6m, 1y, custom",
                )
            resolved_start = resolved_end - timedelta(days=days - 1)

        if resolved_start > resolved_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date must be before or equal to end_date",
            )
        return resolved_start, resolved_end

    def _build_mood_history(
        self,
        entries: list[JournalEntry],
        start_date: date,
        end_date: date,
        granularity: str,
    ) -> list[dict]:
        if granularity not in {"day", "week", "month"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="granularity must be one of: day, week, month",
            )

        buckets: dict[date, list[JournalEntry]] = defaultdict(list)
        for entry in entries:
            buckets[self._bucket_start(entry.created_at.date(), granularity)].append(
                entry
            )

        points = []
        cursor = self._bucket_start(start_date, granularity)
        while cursor <= end_date:
            bucket_end = self._bucket_end(cursor, granularity, end_date)
            bucket_entries = buckets.get(cursor, [])
            average_mood = self._average_mood(bucket_entries)
            points.append(
                {
                    "period_start": cursor.isoformat(),
                    "period_end": bucket_end.isoformat(),
                    "label": self._bucket_label(cursor, granularity),
                    "average_mood": average_mood,
                    "entries_count": len(bucket_entries),
                }
            )
            cursor = self._next_bucket(cursor, granularity)
        return points

    def _top_emotions(self, entries: list[JournalEntry]) -> list[dict]:
        counter: Counter[str] = Counter(
            entry.analysis.emotion_label
            for entry in entries
            if entry.analysis and entry.analysis.emotion_label
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

    def _journaling_frequency(
        self, entries: list[JournalEntry], start_date: date, end_date: date
    ) -> dict:
        total_days = (end_date - start_date).days + 1
        active_days = len({entry.created_at.date() for entry in entries})
        entries_count = len(entries)
        weeks = max(total_days / 7, 1)
        return {
            "total_days": total_days,
            "active_days": active_days,
            "entries_count": entries_count,
            "entries_per_week": round(entries_count / weeks, 2),
            "average_entries_per_active_day": (
                round(entries_count / active_days, 2) if active_days else 0
            ),
            "consistency_percentage": (
                round((active_days / total_days) * 100, 2) if total_days else 0
            ),
        }

    def _streak_calendar(
        self, entries: list[JournalEntry], start_date: date, end_date: date
    ) -> list[dict]:
        grouped: dict[date, list[JournalEntry]] = defaultdict(list)
        for entry in entries:
            grouped[entry.created_at.date()].append(entry)

        days = []
        streak_day = 0
        cursor = start_date
        while cursor <= end_date:
            day_entries = grouped.get(cursor, [])
            if day_entries:
                streak_day += 1
            else:
                streak_day = 0
            days.append(
                {
                    "date": cursor.isoformat(),
                    "has_entry": bool(day_entries),
                    "entries_count": len(day_entries),
                    "average_mood": self._average_mood(day_entries),
                    "streak_day": streak_day,
                }
            )
            cursor += timedelta(days=1)
        return days

    def _correlations(
        self,
        mood_history: list[dict],
        quiz_results: list[AIQuizResult],
        granularity: str,
    ) -> list[dict]:
        mood_values = [point["average_mood"] for point in mood_history]
        frequency_values = [point["entries_count"] for point in mood_history]
        mood_frequency = self._pearson(mood_values, frequency_values)

        quiz_by_bucket: dict[date, list[int]] = defaultdict(list)
        for result in quiz_results:
            severity_score = SEVERITY_SCORE.get(result.severity_level)
            if severity_score is not None:
                quiz_by_bucket[
                    self._bucket_start(result.created_at.date(), granularity)
                ].append(severity_score)

        quiz_mood_values = []
        quiz_severity_values = []
        for point in mood_history:
            bucket_start = date.fromisoformat(point["period_start"])
            severities = quiz_by_bucket.get(bucket_start, [])
            if point["average_mood"] is not None and severities:
                quiz_mood_values.append(point["average_mood"])
                quiz_severity_values.append(sum(severities) / len(severities))

        mood_quiz_severity = self._pearson(quiz_mood_values, quiz_severity_values)

        return [
            self._correlation_payload(
                "mood_vs_journaling_frequency",
                mood_frequency,
                "Compares average mood with how often journal entries were created in the same period.",
            ),
            self._correlation_payload(
                "mood_vs_quiz_severity",
                mood_quiz_severity,
                "Compares average mood with completed quiz severity scores in matching periods.",
            ),
        ]

    def _emotion_heatmap(
        self, entries: list[JournalEntry], start_date: date, end_date: date
    ) -> list[dict]:
        grouped: dict[date, list[JournalEntry]] = defaultdict(list)
        for entry in entries:
            grouped[entry.created_at.date()].append(entry)

        heatmap = []
        cursor = start_date
        max_entries = max((len(items) for items in grouped.values()), default=1)
        while cursor <= end_date:
            day_entries = grouped.get(cursor, [])
            emotion_counter: Counter[str] = Counter(
                entry.analysis.emotion_label
                for entry in day_entries
                if entry.analysis and entry.analysis.emotion_label
            )
            dominant_emotion = (
                emotion_counter.most_common(1)[0][0] if emotion_counter else None
            )
            heatmap.append(
                {
                    "date": cursor.isoformat(),
                    "dominant_emotion": dominant_emotion,
                    "entries_count": len(day_entries),
                    "average_mood": self._average_mood(day_entries),
                    "intensity": (
                        round(len(day_entries) / max_entries, 2) if max_entries else 0
                    ),
                }
            )
            cursor += timedelta(days=1)
        return heatmap

    def _insights(
        self,
        summary: dict,
        mood_history: list[dict],
        top_emotions: list[dict],
        frequency: dict,
        correlations: list[dict],
    ) -> list[dict]:
        insights = []
        average_mood = summary.get("average_mood")
        if average_mood is not None:
            if average_mood >= 7:
                description = "Your average mood is in a strong range for this period. Notice which routines helped sustain it."
            elif average_mood >= 5:
                description = "Your average mood is moderate, suggesting a mixed period with room to identify supportive patterns."
            else:
                description = "Your average mood is lower this period, so gentle support and smaller daily goals may be especially useful."
            insights.append({"title": "Mood baseline", "description": description})

        non_empty_points = [
            point for point in mood_history if point["average_mood"] is not None
        ]
        if len(non_empty_points) >= 2:
            delta = round(
                non_empty_points[-1]["average_mood"]
                - non_empty_points[0]["average_mood"],
                2,
            )
            if delta > 0:
                trend = f"Mood is trending upward by {delta} points from the first to latest active period."
            elif delta < 0:
                trend = f"Mood is trending downward by {abs(delta)} points from the first to latest active period."
            else:
                trend = "Mood is stable between the first and latest active period."
            insights.append({"title": "Mood trend", "description": trend})

        if top_emotions:
            top = top_emotions[0]
            insights.append(
                {
                    "title": "Top emotion",
                    "description": f"{top['emotion_label']} is the most frequent detected emotion, appearing in {top['percentage']}% of analyzed entries.",
                }
            )

        insights.append(
            {
                "title": "Journaling consistency",
                "description": f"You journaled on {frequency['active_days']} of {frequency['total_days']} days ({frequency['consistency_percentage']}% consistency).",
            }
        )

        for correlation in correlations:
            if correlation["coefficient"] is not None:
                insights.append(
                    {
                        "title": correlation["metric"].replace("_", " ").title(),
                        "description": correlation["interpretation"],
                    }
                )
        return insights[:6]

    def _bucket_start(self, value: date, granularity: str) -> date:
        if granularity == "week":
            return value - timedelta(days=value.weekday())
        if granularity == "month":
            return date(value.year, value.month, 1)
        return value

    def _bucket_end(self, start: date, granularity: str, max_end: date) -> date:
        if granularity == "week":
            end = start + timedelta(days=6)
        elif granularity == "month":
            if start.month == 12:
                end = date(start.year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(start.year, start.month + 1, 1) - timedelta(days=1)
        else:
            end = start
        return min(end, max_end)

    def _next_bucket(self, start: date, granularity: str) -> date:
        if granularity == "week":
            return start + timedelta(days=7)
        if granularity == "month":
            if start.month == 12:
                return date(start.year + 1, 1, 1)
            return date(start.year, start.month + 1, 1)
        return start + timedelta(days=1)

    def _bucket_label(self, start: date, granularity: str) -> str:
        if granularity == "week":
            return f"Week of {start.strftime('%b %d')}"
        if granularity == "month":
            return start.strftime("%b %Y")
        return start.strftime("%b %d")

    def _average_mood(self, entries: list[JournalEntry]) -> float | None:
        if not entries:
            return None
        return round(sum(entry.mood_score for entry in entries) / len(entries), 2)

    def _pearson(
        self, left: list[float | int | None], right: list[float | int | None]
    ) -> float | None:
        pairs = [(float(x), float(y)) for x, y in zip(left, right) if x is not None]
        if len(pairs) < 2:
            return None

        xs = [pair[0] for pair in pairs]
        ys = [pair[1] for pair in pairs]
        mean_x = sum(xs) / len(xs)
        mean_y = sum(ys) / len(ys)
        numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
        denominator_x = sqrt(sum((x - mean_x) ** 2 for x in xs))
        denominator_y = sqrt(sum((y - mean_y) ** 2 for y in ys))
        if denominator_x == 0 or denominator_y == 0:
            return None
        return round(numerator / (denominator_x * denominator_y), 3)

    def _correlation_payload(
        self, metric: str, coefficient: float | None, fallback: str
    ) -> dict:
        if coefficient is None:
            return {
                "metric": metric,
                "coefficient": None,
                "strength": "insufficient_data",
                "interpretation": f"{fallback} More data is needed before this relationship is meaningful.",
            }

        absolute = abs(coefficient)
        if absolute >= 0.7:
            strength = "strong"
        elif absolute >= 0.4:
            strength = "moderate"
        elif absolute >= 0.2:
            strength = "weak"
        else:
            strength = "minimal"

        direction = "positive" if coefficient > 0 else "negative"
        return {
            "metric": metric,
            "coefficient": coefficient,
            "strength": strength,
            "interpretation": f"There is a {strength} {direction} relationship. {fallback}",
        }
