from sqlalchemy.orm import Session, joinedload

from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession


class ChatRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, user_id: int, title: str) -> ChatSession:
        session = ChatSession(user_id=user_id, title=title)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_sessions_by_user(self, user_id: int) -> list[ChatSession]:
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .all()
        )

    def get_session_by_id_and_user(self, session_id: int, user_id: int) -> ChatSession | None:
        return (
            self.db.query(ChatSession)
            .options(joinedload(ChatSession.messages))
            .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
            .first()
        )

    def create_message(self, session_id: int, role: str, content: str) -> ChatMessage:
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message