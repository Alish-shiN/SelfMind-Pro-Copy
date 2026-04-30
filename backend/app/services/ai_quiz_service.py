from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.ai_quiz_repository import AIQuizRepository
from app.repo.analytics_repository import AnalyticsRepository
from app.repo.dashboard_repository import DashboardRepository
from app.schemas.ai_quiz import AIQuizGenerateRequest, AIQuizSubmitRequest
from app.services.ai_quiz_engine import AIQuizEngine


class AIQuizService:
    def __init__(self, db: Session):
        self.repo = AIQuizRepository(db)
        self.analytics_repo = AnalyticsRepository(db)
        self.dashboard_repo = DashboardRepository(db)
        self.engine = AIQuizEngine()

    def generate_quiz(self, current_user: User, payload: AIQuizGenerateRequest):
        context = self._build_context(current_user)
        questions = self.engine.generate_questions(payload.quiz_type, context)

        return self.repo.create_session(
            user_id=current_user.id,
            quiz_type=payload.quiz_type,
            generated_questions=questions,
        )

    def get_session(self, current_user: User, session_id: int):
        session = self.repo.get_session_by_id_and_user(session_id, current_user.id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz session not found"
            )

        return {
            "session": session,
            "result": session.result,
        }

    def submit_quiz(self, current_user: User, session_id: int, payload: AIQuizSubmitRequest):
        session = self.repo.get_session_by_id_and_user(session_id, current_user.id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz session not found"
            )

        self.repo.delete_answers_for_session(session.id)
        self.repo.create_answers(session.id, [item.model_dump() for item in payload.answers])

        context = self._build_context(current_user)
        result_data = self.engine.analyze_answers(
            quiz_type=session.quiz_type,
            questions=session.generated_questions,
            answers=[item.model_dump() for item in payload.answers],
            context=context,
        )

        result = self.repo.create_or_replace_result(
            session_id=session.id,
            overall_score=result_data["overall_score"],
            severity_level=result_data["severity_level"],
            insight=result_data["insight"],
            recommendation=result_data["recommendation"],
            practice=result_data["practice"],
        )

        self.repo.mark_session_completed(session)
        return result

    def _build_context(self, current_user: User) -> dict:
        summary = self.analytics_repo.get_summary(current_user.id)
        latest_analysis = self.dashboard_repo.get_latest_analysis(current_user.id)

        return {
            "average_mood": summary.get("average_mood"),
            "total_entries": summary.get("total_entries"),
            "latest_emotion": latest_analysis.emotion_label if latest_analysis else None,
        }