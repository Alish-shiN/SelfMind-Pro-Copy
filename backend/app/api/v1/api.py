from fastapi import APIRouter

from app.api.v1.endpoints import (
    analysis,
    analytics,
    auth,
    chat,
    community,
    dashboard,
    journal,
    users,
    ai_quiz,
    admin,
    reminders,
    safety
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(journal.router)
api_router.include_router(analytics.router)
api_router.include_router(analysis.router)
api_router.include_router(dashboard.router)
api_router.include_router(chat.router)
api_router.include_router(community.router)
api_router.include_router(ai_quiz.router)
api_router.include_router(admin.router)
api_router.include_router(reminders.router)
api_router.include_router(safety.router)
