import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import TriggerRequest, TriggerResponse

router = APIRouter(prefix='/trigger', tags=['trigger'])


@router.post('', response_model=TriggerResponse)
def send_to_n8n(
    payload: TriggerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TriggerResponse:
    """Teruskan {jenis, data} dari frontend ke workflow n8n via webhook."""
    if not settings.n8n_webhook_url:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            'N8N_WEBHOOK_URL belum diatur di .env',
        )

    body = {
        'jenis': payload.jenis,
        'data': payload.data,
        'user': current_user.username,
    }

    try:
        resp = httpx.post(settings.n8n_webhook_url, json=body, timeout=15.0)
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, 'Gagal menghubungi n8n')

    if resp.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f'n8n merespons {resp.status_code}')

    return TriggerResponse(status='terkirim', n8n_status=resp.status_code)
