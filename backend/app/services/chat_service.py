from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repo.chat_repository import ChatRepository
from app.schemas.chat import ChatMessageCreate, ChatSessionCreate
from app.services.ai_chat_engine import AIChatEngine
from app.services.personalization_service import PersonalizationService
from app.services.safety_service import SafetyService


class ChatService:
    def __init__(self, db: Session):
        self.chat_repo = ChatRepository(db)
        self.engine = AIChatEngine()
        self.personalization_service = PersonalizationService(db)
        self.safety_service = SafetyService(db)

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
                status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
            )

        return {
            "session": session,
            "messages": session.messages,
        }

    def send_message(
        self, current_user: User, session_id: int, payload: ChatMessageCreate
    ):
        session = self.chat_repo.get_session_by_id_and_user(session_id, current_user.id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
            )

        user_message = self.chat_repo.create_message(
            session_id=session.id,
            role="user",
            content=payload.content,
        )

        self.safety_service.flag_if_needed(
            current_user, "chat_message", user_message.id, payload.content
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
        return self.personalization_service.build_context(current_user)
