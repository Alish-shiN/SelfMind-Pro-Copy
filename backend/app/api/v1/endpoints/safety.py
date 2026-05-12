from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.safety import CrisisResource, SafetyCheckRequest, SafetyCheckResponse, SafetyFlagResponse
from app.services.safety_service import SafetyService

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/resources", response_model=list[CrisisResource])
def get_crisis_resources(db: Session = Depends(get_db)):
    return SafetyService(db).get_resources()


@router.post("/check", response_model=SafetyCheckResponse)
def check_text(
    payload: SafetyCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SafetyService(db).check_text(payload)


@router.get("/flags/me", response_model=list[SafetyFlagResponse])
def get_my_safety_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SafetyService(db).get_my_flags(current_user)
