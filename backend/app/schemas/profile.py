from datetime import datetime
from pydantic import BaseModel


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }