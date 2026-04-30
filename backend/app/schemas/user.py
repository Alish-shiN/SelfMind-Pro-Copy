from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }