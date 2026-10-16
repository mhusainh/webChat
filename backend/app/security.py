import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

_ITERATIONS = 100_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), _ITERATIONS).hex()
    return f'{salt}${digest}'


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split('$', 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), _ITERATIONS).hex()
    return hmac.compare_digest(candidate, digest)


def _create_token(user_id: int, username: str, token_type: str, expires_delta: timedelta) -> str:
    payload = {
        'sub': str(user_id),
        'username': username,
        'type': token_type,
        'exp': datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: int, username: str) -> str:
    return _create_token(user_id, username, 'access', timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user_id: int, username: str) -> str:
    return _create_token(user_id, username, 'refresh', timedelta(days=settings.refresh_token_expire_days))


def _decode_token(token: str, expected_type: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get('type') != expected_type:
        return None
    return payload


def decode_access_token(token: str) -> dict | None:
    return _decode_token(token, 'access')


def decode_refresh_token(token: str) -> dict | None:
    return _decode_token(token, 'refresh')
