from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, RefreshRequest, TokenResponse
from app.security import create_access_token, create_refresh_token, decode_refresh_token, verify_password

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/login', response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username))
    if user is None or not verify_password(data.password, user.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Username atau password salah')

    return TokenResponse(
        access_token=create_access_token(user.id, user.username),
        refresh_token=create_refresh_token(user.id, user.username),
    )


@router.post('/refresh', response_model=TokenResponse)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_refresh_token(data.refresh_token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Refresh token tidak valid atau kedaluwarsa')

    user = db.get(User, int(payload['sub']))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'User tidak ditemukan')

    return TokenResponse(
        access_token=create_access_token(user.id, user.username),
        refresh_token=create_refresh_token(user.id, user.username),
    )
