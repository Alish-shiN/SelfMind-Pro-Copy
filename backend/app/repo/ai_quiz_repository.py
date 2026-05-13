from sqlalchemy.orm import Session, joinedload

from app.models.ai_quiz_answer import AIQuizAnswer
from app.models.ai_quiz_result import AIQuizResult
from app.models.ai_quiz_session import AIQuizSession


class AIQuizRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(
        self, user_id: int, quiz_type: str, generated_questions: list
    ) -> AIQuizSession:
        session = AIQuizSession(
            user_id=user_id,
            quiz_type=quiz_type,
            status="generated",
            generated_questions=generated_questions,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session_by_id_and_user(
        self, session_id: int, user_id: int
    ) -> AIQuizSession | None:
        return (
            self.db.query(AIQuizSession)
            .options(
                joinedload(AIQuizSession.answers),
                joinedload(AIQuizSession.result),
            )
            .filter(AIQuizSession.id == session_id, AIQuizSession.user_id == user_id)
            .first()
        )

    def create_answers(
        self, session_id: int, answers: list[dict]
    ) -> list[AIQuizAnswer]:
        created = []
        for item in answers:
            answer = AIQuizAnswer(
                session_id=session_id,
                question_index=item["question_index"],
                question_text=item["question_text"],
                answer_text=item["answer_text"],
                score=item.get("score"),
            )
            self.db.add(answer)
            created.append(answer)

        self.db.commit()
        for answer in created:
            self.db.refresh(answer)
        return created

    def delete_answers_for_session(self, session_id: int) -> None:
        self.db.query(AIQuizAnswer).filter(
            AIQuizAnswer.session_id == session_id
        ).delete()
        self.db.commit()

    def create_or_replace_result(
        self,
        session_id: int,
        overall_score: float,
        severity_level: str,
        insight: str,
        recommendation: str,
        practice: str,
        quiz_type: str | None = None,
        answers_snapshot: list | None = None,
        recommendations: list | None = None,
        micro_practices: list | None = None,
        action_plan: dict | None = None,
        trend_direction: str | None = None,
        previous_score: float | None = None,
        score_difference: float | None = None,
        trend_explanation: str | None = None,
    ) -> AIQuizResult:
        existing = (
            self.db.query(AIQuizResult)
            .filter(AIQuizResult.session_id == session_id)
            .first()
        )
        if existing:
            self.db.delete(existing)
            self.db.commit()

        result = AIQuizResult(
            session_id=session_id,
            overall_score=overall_score,
            severity_level=severity_level,
            insight=insight,
            recommendation=recommendation,
            practice=practice,
            quiz_type=quiz_type,
            answers_snapshot=answers_snapshot,
            recommendations=recommendations,
            micro_practices=micro_practices,
            action_plan=action_plan,
            trend_direction=trend_direction,
            previous_score=previous_score,
            score_difference=score_difference,
            trend_explanation=trend_explanation,
        )
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        return result

    def mark_session_completed(self, session: AIQuizSession) -> AIQuizSession:
        session.status = "completed"
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_latest_result_for_type(
        self, user_id: int, quiz_type: str, exclude_session_id: int | None = None
    ) -> AIQuizResult | None:
        quiz_types = {quiz_type}
        if quiz_type == "stress":
            quiz_types.add("stress_reflection")
        query = (
            self.db.query(AIQuizResult)
            .join(AIQuizSession, AIQuizResult.session_id == AIQuizSession.id)
            .filter(AIQuizSession.user_id == user_id)
            .filter(AIQuizSession.quiz_type.in_(quiz_types))
        )
        if exclude_session_id is not None:
            query = query.filter(AIQuizResult.session_id != exclude_session_id)
        return query.order_by(AIQuizResult.created_at.desc()).first()

    def list_completed_results(
        self, user_id: int, limit: int = 25
    ) -> list[AIQuizResult]:
        return (
            self.db.query(AIQuizResult)
            .join(AIQuizSession, AIQuizResult.session_id == AIQuizSession.id)
            .options(joinedload(AIQuizResult.session))
            .filter(AIQuizSession.user_id == user_id)
            .order_by(AIQuizResult.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_result_by_id_and_user(
        self, result_id: int, user_id: int
    ) -> AIQuizResult | None:
        return (
            self.db.query(AIQuizResult)
            .join(AIQuizSession, AIQuizResult.session_id == AIQuizSession.id)
            .options(joinedload(AIQuizResult.session))
            .filter(AIQuizResult.id == result_id, AIQuizSession.user_id == user_id)
            .first()
        )

    def get_latest_action_plan(self, user_id: int) -> AIQuizResult | None:
        return (
            self.db.query(AIQuizResult)
            .join(AIQuizSession, AIQuizResult.session_id == AIQuizSession.id)
            .options(joinedload(AIQuizResult.session))
            .filter(AIQuizSession.user_id == user_id)
            .filter(AIQuizResult.action_plan.isnot(None))
            .order_by(AIQuizResult.created_at.desc())
            .first()
        )
