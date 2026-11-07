"""Terima status langkah dari n8n (POST tanpa JWT), simpan, siarkan via WebSocket."""

from fastapi import APIRouter, Depends, Query, status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Responses, User
from app.schemas import ResponseIn, ResponseOut
from app.ws import manager

router = APIRouter(prefix='/responses', tags=['responses'])


@router.post('', response_model=ResponseOut, status_code=http_status.HTTP_201_CREATED)
async def simpan_response(payload: ResponseIn, db: Session = Depends(get_db)) -> Responses:
    row = Responses(
        jenis=payload.jenis,
        status=payload.status,
        response=payload.response if payload.response is not None else {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    await manager.broadcast(
        {'type': 'response', 'data': ResponseOut.model_validate(row).model_dump(mode='json')}
    )
    return row


@router.get('', response_model=list[ResponseOut])
def daftar_response(
    jenis: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Responses]:
    """Riwayat status (JWT), diurutkan id terbaru dulu; `jenis` menyaring per halaman."""
    stmt = select(Responses).order_by(Responses.id.desc()).limit(limit)
    if jenis:
        stmt = stmt.where(Responses.jenis == jenis)
    return list(db.scalars(stmt).all())
