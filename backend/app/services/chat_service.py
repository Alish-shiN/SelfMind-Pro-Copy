from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.analytics_repository import AnalyticsRepository
from app.repo.chat_repository import ChatRepository
from app.repo.dashboard_repository import DashboardRepository
from app.schemas.chat import ChatMessageCreate, ChatSessionCreate
from app.services.ai_chat_engine import AIChatEngine

class ChatService:
    def __init__(self, db: Session):
        self.chat_repo = ChatRepository(db)
        self.analytics_repo = AnalyticsRepository(db)
        self.dashboard_repo = DashboardRepository(db)
        self.engine = AIChatEngine()
        
    def create_session(self, current_user: User, payload: ChatSessionCreate):
        return self.chat_repo.create_session(
            user_id=current_user.id,
            title=payload.title,
        )

    def get_my_sessions(self, current_user: User):
        return self.chat_repo.get_sessions_by_user(current_user.id)

    def get_session_detail(self, current_user: User, session_id: int):
        session = self.chat_repo.get_session_by_id_and_user(session_id, current_user.id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )

        return {
            "session": session,
            "messages": session.messages,
        }

    def send_message(self, current_user: User, session_id: int, payload: ChatMessageCreate):
        session = self.chat_repo.get_session_by_id_and_user(session_id, current_user.id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )

        user_message = self.chat_repo.create_message(
            session_id=session.id,
            role="user",
            content=payload.content,
        )

        context = self._build_context(current_user)
        assistant_reply = self.engine.generate_reply(
            user_message=payload.content,
            context=context,
        )

        assistant_message = self.chat_repo.create_message(
            session_id=session.id,
            role="assistant",
            content=assistant_reply,
        )

        return {
            "user_message": user_message,
            "assistant_message": assistant_message,
        }

    def _build_context(self, current_user: User) -> dict:
        summary = self.analytics_repo.get_summary(current_user.id)
        latest_analysis = self.dashboard_repo.get_latest_analysis(current_user.id)

        return {
            "average_mood": summary.get("average_mood"),
            "latest_emotion": latest_analysis.emotion_label if latest_analysis else None,
        }