from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardHomeResponse
from app.services.cache_service import (
    CacheNamespace,
    CacheTTL,
    cache_get_or_set,
    user_cache_key,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/home", response_model=DashboardHomeResponse)
def get_dashboard_home(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = user_cache_key(CacheNamespace.DASHBOARD, current_user.id, "home")
    return cache_get_or_set(
        key,
        CacheTTL.DASHBOARD,
        lambda: DashboardService(db).get_home(current_user),
        response_model=DashboardHomeResponse,
    )
