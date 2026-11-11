"""Endpoint Revo.

- POST /api/revo/push   : cermin dari listener 8014, untuk uji/curl tanpa perangkat.
- GET  /api/revo/attlog : kontrak JSON yang dibaca getRevo.py (dipanggil n8n).
- PUT  /api/revo/users  : perbaiki nama karyawan (lama, tanpa JWT).
- CRUD /api/revo/users + GET/DELETE /api/revo/riwayat : kelola revo_users &
  riwayat gabungan revo_attend x revo_users (wajib JWT). GET riwayat mendukung
  search nama, filter peran & rentang tanggal, plus urut nama/tanggal. DELETE
  riwayat hanya menghapus baris kehadiran, tidak menyentuh pekerja.
"""

from datetime import date as tanggal_hari

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import RevoAttend, RevoUser, User
from app.revo_fksdk import (
    RevoError,
    ambil_attlog,
    parse_jam,
    parse_target_date,
    process_push,
    set_user_nama,
)
from app.schemas import (
    RevoRiwayatOut,
    RevoUserCreate,
    RevoUserOut,
    RevoUserSet,
    RevoUserUpdate,
)

router = APIRouter(prefix='/revo', tags=['revo'])

GAGAL = 400

URUT_RIWAYAT = ('time_desc', 'time_asc', 'name_asc', 'name_desc')


def _parse_tanggal(nilai: str) -> tanggal_hari:
    """Tanggal filter wajib YYYY-MM-DD valid; salah = 400 (bukan 500)."""
    try:
        return parse_target_date(nilai)
    except RevoError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)[:300]) from exc


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


@router.get('/users', response_model=list[RevoUserOut])
def daftar_user(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(select(RevoUser).order_by(RevoUser.id)).all()


@router.post('/users', response_model=RevoUserOut, status_code=status.HTTP_201_CREATED)
def buat_user(
    data: RevoUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    exists = db.scalar(select(RevoUser).where(RevoUser.user_id == data.user_id))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, 'PIN sudah terdaftar')
    item = RevoUser(user_id=data.user_id, name=data.name, role=data.role)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put('/users/{uid}', response_model=RevoUserOut)
def ubah_user(
    uid: str,
    data: RevoUserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.scalar(select(RevoUser).where(RevoUser.user_id == uid))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Pekerja tidak ditemukan')
    item.name = data.name
    item.role = data.role
    db.commit()
    db.refresh(item)
    return item


@router.delete('/users/{uid}', status_code=status.HTTP_204_NO_CONTENT)
def hapus_user(
    uid: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.scalar(select(RevoUser).where(RevoUser.user_id == uid))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Pekerja tidak ditemukan')
    # SQLite (test) tidak menyalakan PRAGMA foreign_keys, jadi riwayat dihapus
    # eksplisit; di Postgres, ON DELETE CASCADE tetap jadi jaring pengaman.
    db.execute(delete(RevoAttend).where(RevoAttend.user_id == uid))
    db.delete(item)
    db.commit()


@router.get('/riwayat', response_model=list[RevoRiwayatOut])
def riwayat(
    target_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    role: str | None = None,
    sort: str = 'time_desc',
    limit: int = 500,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Riwayat kehadiran: revo_attend LEFT JOIN revo_users per user_id.

    Filter: search (sebagian nama, huruf besar-kecil bebas), role (cocok persis;
    '' = tanpa peran), date_from/date_to (rentang tanggal, format YYYY-MM-DD).
    Urut: time_desc (default), time_asc, name_asc, name_desc.
    """
    batas = max(1, min(limit, 2000))
    if sort not in URUT_RIWAYAT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'SORT_TIDAK_VALID {sort}')

    stmt = (
        select(
            RevoAttend.id,
            RevoAttend.user_id,
            RevoUser.name.label('nama'),
            RevoUser.role,
            RevoAttend.timestamp,
        )
        .outerjoin(RevoUser, RevoUser.user_id == RevoAttend.user_id)
    )
    kata = (search or '').strip()
    if kata:
        stmt = stmt.where(RevoUser.name.ilike(f'%{kata}%'))
    if role is not None:
        stmt = stmt.where(RevoUser.role == role)
    if target_date:
        tgl = _parse_tanggal(target_date)
        stmt = stmt.where(
            RevoAttend.timestamp >= f'{tgl.isoformat()} 00:00:00',
            RevoAttend.timestamp <= f'{tgl.isoformat()} 23:59:59',
        )
    if date_from:
        tgl = _parse_tanggal(date_from)
        stmt = stmt.where(RevoAttend.timestamp >= f'{tgl.isoformat()} 00:00:00')
    if date_to:
        tgl = _parse_tanggal(date_to)
        stmt = stmt.where(RevoAttend.timestamp <= f'{tgl.isoformat()} 23:59:59')

    nama_urut = func.coalesce(RevoUser.name, '')
    if sort == 'name_asc':
        stmt = stmt.order_by(nama_urut.asc(), RevoAttend.timestamp.desc())
    elif sort == 'name_desc':
        stmt = stmt.order_by(nama_urut.desc(), RevoAttend.timestamp.desc())
    elif sort == 'time_asc':
        stmt = stmt.order_by(RevoAttend.timestamp.asc(), RevoAttend.id.asc())
    else:
        stmt = stmt.order_by(RevoAttend.timestamp.desc(), RevoAttend.id.desc())

    rows = db.execute(stmt.limit(batas)).all()
    return [
        {
            'id': r.id,
            'user_id': r.user_id,
            'nama': r.nama or '',
            'role': r.role or '',
            'timestamp': r.timestamp,
        }
        for r in rows
    ]


@router.delete('/riwayat/{baris_id}', status_code=status.HTTP_204_NO_CONTENT)
def hapus_baris_riwayat(
    baris_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Hapus satu catatan kehadiran (revo_attend) — pekerja di revo_users tetap ada."""
    item = db.get(RevoAttend, baris_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Catatan kehadiran tidak ditemukan')
    db.delete(item)
    db.commit()
