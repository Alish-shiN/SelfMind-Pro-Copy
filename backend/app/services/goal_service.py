from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.models.goal_completion import GoalCompletion
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.goals import GoalCreate, GoalUpdate

SELF_CARE_TEMPLATES = [
    {
        "key": "mindful_breathing",
        "title": "Mindful breathing",
        "description": "Take a short breathing pause and notice how you feel afterward.",
    },
    {
        "key": "short_walk",
        "title": "Short walk",
        "description": "Step away for a brief walk or gentle movement break.",
    },
    {
        "key": "sleep_reflection",
        "title": "Sleep reflection",
        "description": "Reflect on what helped or disrupted your rest.",
    },
    {
        "key": "gratitude_note",
        "title": "Gratitude note",
        "description": "Write down one small thing you appreciated today.",
    },
    {
        "key": "water_intake",
        "title": "Water intake",
        "description": "Pause to drink water and check in with your body.",
    },
    {
        "key": "screen_break",
        "title": "Screen break",
        "description": "Take a short break away from screens.",
    },
    {
        "key": "talk_to_someone",
        "title": "Talk to someone",
        "description": "Reach out to someone supportive or friendly.",
    },
    {
        "key": "custom",
        "title": "Custom self-care goal",
        "description": "Create your own supportive self-care practice.",
    },
]


class GoalService:
    def __init__(self, db: Session):
        self.db = db

    def templates(self) -> list[dict]:
        return [
            {
                **template,
                "goal_type": "self_care",
                "target_count": 1,
                "period": "weekly",
            }
            for template in SELF_CARE_TEMPLATES
        ]

    def list_goals(self, current_user: User, include_inactive: bool = False):
        query = self.db.query(Goal).filter(Goal.user_id == current_user.id)
        if not include_inactive:
            query = query.filter(Goal.is_active.is_(True))
        return query.order_by(Goal.created_at.desc()).all()

    def create_goal(self, current_user: User, payload: GoalCreate) -> Goal:
        goal = Goal(
            user_id=current_user.id,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            goal_type=payload.goal_type,
            target_count=payload.target_count,
            period=payload.period,
            template_key=payload.template_key,
            is_active=True,
        )
        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def update_goal(
        self, current_user: User, goal_id: int, payload: GoalUpdate
    ) -> Goal:
        goal = self._get_owned_goal(current_user, goal_id)
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                if isinstance(value, str):
                    value = value.strip()
                setattr(goal, field, value)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def delete_goal(self, current_user: User, goal_id: int) -> None:
        goal = self._get_owned_goal(current_user, goal_id)
        self.db.delete(goal)
        self.db.commit()

    def complete_goal(self, current_user: User, goal_id: int, note: str | None = None):
        goal = self._get_owned_goal(current_user, goal_id)
        if goal.goal_type in {"reflection", "mood_tracking"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reflection and mood tracking goals are calculated from journal activity.",
            )
        completion = GoalCompletion(
            goal_id=goal.id,
            user_id=current_user.id,
            note=note.strip() if note else None,
        )
        self.db.add(completion)
        self.db.commit()
        self.db.refresh(completion)
        return self.progress_for_goal(goal)

    def progress(self, current_user: User) -> list[dict]:
        return [self.progress_for_goal(goal) for goal in self.list_goals(current_user)]

    def weekly_summary(self, current_user: User) -> dict:
        goals = self.progress(current_user)
        active_goals = len(goals)
        completed = len([item for item in goals if item["is_completed"]])
        partial = len(
            [
                item
                for item in goals
                if not item["is_completed"] and item["current_count"] > 0
            ]
        )
        missed = max(active_goals - completed - partial, 0)
        percentage = (
            round(sum(item["progress_percentage"] for item in goals) / active_goals, 2)
            if active_goals
            else 0
        )
        start, end = self._period_bounds("weekly")
        return {
            "period_start": start.date().isoformat(),
            "period_end": end.date().isoformat(),
            "active_goals": active_goals,
            "completed_goals": completed,
            "partially_completed_goals": partial,
            "missed_goals": missed,
            "overall_completion_percentage": percentage,
            "supportive_message": self._summary_message(
                completed, partial, active_goals
            ),
            "goals": goals,
        }

    def progress_for_goal(self, goal: Goal) -> dict:
        start, end = self._period_bounds(goal.period)
        current = self._current_count(goal, start, end)
        percentage = min(round((current / goal.target_count) * 100, 2), 100)
        completed = current >= goal.target_count
        return {
            "goal": goal,
            "current_count": current,
            "target_count": goal.target_count,
            "progress_percentage": percentage,
            "is_completed": completed,
            "period_start": start.date().isoformat(),
            "period_end": end.date().isoformat(),
            "message": self._progress_message(goal, current, completed),
        }

    def _current_count(self, goal: Goal, start: datetime, end: datetime) -> int:
        if goal.goal_type in {"reflection", "mood_tracking"}:
            # Safe fallback: this app stores each mood score on a journal entry, so
            # mood tracking progress uses journal entries with mood_score present.
            return (
                self.db.query(JournalEntry)
                .filter(
                    JournalEntry.user_id == goal.user_id,
                    JournalEntry.created_at >= start,
                    JournalEntry.created_at <= end,
                    JournalEntry.mood_score.isnot(None),
                )
                .count()
            )
        return (
            self.db.query(GoalCompletion)
            .filter(
                GoalCompletion.goal_id == goal.id,
                GoalCompletion.user_id == goal.user_id,
                GoalCompletion.created_at >= start,
                GoalCompletion.created_at <= end,
            )
            .count()
        )

    def _period_bounds(self, period: str) -> tuple[datetime, datetime]:
        today = date.today()
        if period == "daily":
            start_date = today
            end_date = today
        else:
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
        return start, end

    def _progress_message(self, goal: Goal, current: int, completed: bool) -> str:
        period_label = "today" if goal.period == "daily" else "this week"
        if goal.goal_type == "reflection":
            return (
                f"You reflected {current} times {period_label}. This shows consistent emotional check-ins."
                if current
                else "Small progress still counts. One reflection can be a meaningful check-in."
            )
        if goal.goal_type == "mood_tracking":
            return (
                f"You tracked your mood {current} times {period_label}. This can help you notice patterns."
                if current
                else "A quick mood note can help you understand your week."
            )
        if completed:
            return (
                "You completed this supportive practice. Small steady actions matter."
            )
        if current:
            return f"You made {current} step{'s' if current != 1 else ''} toward this goal. Small progress still counts."
        return "Small progress still counts. Choose one gentle next step when you can."

    def _summary_message(self, completed: int, partial: int, active: int) -> str:
        if active == 0:
            return "Choose one small goal to connect reflection with self-improvement."
        if completed == active:
            return (
                "You completed your active goals this week. Keep noticing what helped."
            )
        if completed or partial:
            return "Small progress still counts. Your check-ins are helping build awareness."
        return "A new week is a fresh chance to take one gentle step."

    def _get_owned_goal(self, current_user: User, goal_id: int) -> Goal:
        goal = (
            self.db.query(Goal)
            .filter(Goal.id == goal_id, Goal.user_id == current_user.id)
            .first()
        )
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
            )
        return goal
