from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_.-]+$')
    password: str = Field(min_length=3, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {'from_attributes': True}


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=3, max_length=128)


class TriggerRequest(BaseModel):
    jenis: str = Field(min_length=1, max_length=100)
    data: str = Field(min_length=1, max_length=4000)


class TriggerResponse(BaseModel):
    status: str
    n8n_status: int | None = None
    detail: str | None = None
