from sqlalchemy.orm import Session, joinedload

from app.models.ai_quiz_answer import AIQuizAnswer
from app.models.ai_quiz_result import AIQuizResult
from app.models.ai_quiz_session import AIQuizSession


class AIQuizRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, user_id: int, quiz_type: str, generated_questions: list) -> AIQuizSession:
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

    def get_session_by_id_and_user(self, session_id: int, user_id: int) -> AIQuizSession | None:
        return (
            self.db.query(AIQuizSession)
            .options(
                joinedload(AIQuizSession.answers),
                joinedload(AIQuizSession.result),
            )
            .filter(AIQuizSession.id == session_id, AIQuizSession.user_id == user_id)
            .first()
        )

    def create_answers(self, session_id: int, answers: list[dict]) -> list[AIQuizAnswer]:
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
        self.db.query(AIQuizAnswer).filter(AIQuizAnswer.session_id == session_id).delete()
        self.db.commit()

    def create_or_replace_result(
        self,
        session_id: int,
        overall_score: float,
        severity_level: str,
        insight: str,
        recommendation: str,
        practice: str,
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