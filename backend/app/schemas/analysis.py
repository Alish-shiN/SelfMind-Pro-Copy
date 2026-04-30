from datetime import datetime
from pydantic import BaseModel


class JournalAnalysisResponse(BaseModel):
    id: int
    journal_entry_id: int
    sentiment_label: str
    emotion_label: str
    confidence_score: float
    short_summary: str
    recommendation: str
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }