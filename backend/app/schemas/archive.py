from datetime import datetime
from pydantic import BaseModel


class ArchiveSearchResult(BaseModel):
    id: int
    result_type: str
    title: str
    content_preview: str
    mood_score: int
    tags: list[str] | None = None
    is_private: bool
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime
    sentiment_label: str | None = None
    emotion_label: str | None = None
    insight_summary: str | None = None
    recommendation: str | None = None
