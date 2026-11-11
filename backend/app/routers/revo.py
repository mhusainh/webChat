"""Endpoint Revo — tanpa JWT dan NOL database.

- POST /api/revo/push : cermin dari listener 8014, untuk uji/curl tanpa perangkat.
- GET  /api/revo/attlog : kontrak JSON yang dibaca getRevo.py (dipanggil n8n).
- PUT  /api/revo/users : perbaiki nama karyawan di RAM.
"""

from datetime import date as tanggal_hari

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.revo_fksdk import (
    RevoError,
    ambil_attlog,
    parse_jam,
    parse_target_date,
    process_push,
    set_user_nama,
)
from app.schemas import RevoUserSet

router = APIRouter(prefix='/revo', tags=['revo'])

GAGAL = 400


def _tolak_kunci(request: Request) -> JSONResponse | None:
    """REVO_API_KEY kosong = bebas (dev). Terisi = pembaca wajib bawa X-API-Key."""
    kunci = settings.revo_api_key
    if kunci and request.headers.get('x-api-key', '') != kunci:
        return JSONResponse({'ok': False, 'error': 'API_KEY_TIDAK_VALID'}, status_code=401)
    return None


@router.post('/push')
async def push(request: Request) -> Response:
    body = await request.body()
    headers, balasan = process_push(
        request.headers.get('request_code', ''),
        request.headers.get('dev_id', ''),
        request.headers.get('trans_id', '0'),
        body,
    )
    return Response(content=balasan, media_type='application/json', headers=headers)


@router.get('/attlog')
def attlog(
    request: Request,
    target_date: str | None = None,
    jam_mulai: int | None = None,
    jam_akhir: int | None = None,
) -> JSONResponse:
    ditolak = _tolak_kunci(request)
    if ditolak:
        return ditolak
    try:
        tanggal = parse_target_date(target_date) if target_date else tanggal_hari.today()
        mulai = parse_jam(0 if jam_mulai is None else jam_mulai, 'JAM_MULAI')
        akhir = parse_jam(8 if jam_akhir is None else jam_akhir, 'JAM_AKHIR')
        return JSONResponse(ambil_attlog(tanggal, mulai, akhir))
    except RevoError as exc:
        return JSONResponse({'ok': False, 'error': str(exc)[:300]}, status_code=GAGAL)


@router.put('/users')
def set_nama(payload: RevoUserSet, request: Request) -> JSONResponse:
    ditolak = _tolak_kunci(request)
    if ditolak:
        return ditolak
    set_user_nama(payload.user_id, payload.nama)
    return JSONResponse({'ok': True, 'message': f"User {payload.user_id} disimpan dengan nama '{payload.nama}'"})
