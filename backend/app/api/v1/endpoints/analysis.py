from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.analysis import JournalAnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/journal/{entry_id}", response_model=JournalAnalysisResponse)
def get_journal_entry_analysis(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalysisService(db).get_entry_analysis(current_user, entry_id)


@router.post(
    "/journal/{entry_id}/regenerate",
    response_model=JournalAnalysisResponse,
    status_code=status.HTTP_200_OK,
)
def regenerate_journal_entry_analysis(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalysisService(db).regenerate_for_entry(current_user, entry_id)