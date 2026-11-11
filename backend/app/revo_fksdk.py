"""Protokol FKSDK HTTP untuk mesin Fingerspot Revo.

Data absensi (user_id dan timestamp saja) disimpan langsung ke tabel `revo_attend`.
Anti-duplikasi dijamin lewat Primary Key composite (user_id, timestamp).
Semua tanggal scan diterima tanpa pembatasan hari.
"""

import json
import re
import struct
from datetime import date, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import SessionLocal
from app.models import RevoAttend, RevoUser

WAKTU = '%Y-%m-%d %H:%M:%S'


class RevoError(Exception):
    pass


def reset_memory() -> None:
    """Bersihkan data tabel revo_attend dan revo_users (berguna saat test)."""
    with SessionLocal() as db:
        db.execute(delete(RevoAttend))
        db.execute(delete(RevoUser))
        db.commit()


def parse_fk_payload(body: bytes) -> dict:
    if len(body) < 4:
        return {}
    teks = body.decode('latin1', errors='ignore')
    mulai, akhir = teks.find('{'), teks.rfind('}')
    if mulai != -1 and akhir > mulai:
        try:
            return json.loads(teks[mulai:akhir + 1])
        except ValueError:
            return {}
    return {}


def format_io_time(nilai) -> str:
    s = str(nilai or '').strip()
    cocok = re.match(r'^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$', s)
    if cocok:
        g = cocok.groups()
        return f'{g[0]}-{g[1]}-{g[2]} {g[3]}:{g[4]}:{g[5]}'
    return s


def parse_target_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    cocok = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', s)
    if not cocok:
        raise RevoError(f'TARGET_DATE_TIDAK_VALID {value}')
    try:
        return date(int(cocok.group(1)), int(cocok.group(2)), int(cocok.group(3)))
    except ValueError as exc:
        raise RevoError(f'TARGET_DATE_TIDAK_VALID {value} ({exc})') from None


def parse_jam(value, nama: str) -> int:
    try:
        jam = int(str(value).strip())
    except (TypeError, ValueError):
        raise RevoError(f'{nama}_TIDAK_VALID {value}') from None
    if not 0 <= jam <= 23:
        raise RevoError(f'{nama}_TIDAK_VALID {value}')
    return jam


def compute_window(target: date, jam_mulai: int, jam_akhir: int) -> tuple[datetime, datetime]:
    """Jendela D jam_mulai:00:00 s/d D+1 jam_akhir:00:00 (default 00:00 -> 08:00)."""
    mulai = datetime(target.year, target.month, target.day, jam_mulai, 0, 0)
    d_plus = target + timedelta(days=1)
    akhir = datetime(d_plus.year, d_plus.month, d_plus.day, jam_akhir, 0, 0)
    return mulai, akhir


def _balasan(trans_id: str) -> tuple[dict, bytes]:
    """ACK wajib: 200 + response_code OK + trans_id."""
    headers = {
        'response_code': 'OK',
        'trans_id': str(trans_id or '0'),
        'Content-Type': 'application/octet-stream',
    }
    return headers, b''


def simpan_pukulan(uid: str, ts: str) -> bool:
    """Simpan ke tabel revo_attend. Kembalikan True jika baru, False jika duplikat."""
    with SessionLocal() as db:
        # Pastikan user ada di revo_users agar relasi FK CASCADE tidak menolak
        user_exists = db.scalar(select(RevoUser.id).where(RevoUser.user_id == uid))
        if user_exists is None:
            try:
                db.add(RevoUser(user_id=uid, name='Belum Diberi Nama', role=''))
                db.commit()
            except IntegrityError:
                db.rollback()

        exists = db.scalar(
            select(RevoAttend.id).where(
                RevoAttend.user_id == uid,
                RevoAttend.timestamp == ts
            )
        )
        if exists is not None:
            return False
        try:
            db.add(RevoAttend(user_id=uid, timestamp=ts))
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            return False


def set_user_nama(uid: str, nama: str) -> None:
    with SessionLocal() as db:
        row = db.scalar(select(RevoUser).where(RevoUser.user_id == uid))
        if row is None:
            db.add(RevoUser(user_id=uid, name=nama, role='Karyawan'))
        else:
            row.name = nama
        db.commit()


def process_push(request_code: str, dev_id: str, trans_id: str, body: bytes) -> tuple[dict, bytes]:
    """Terima satu POST perangkat, simpan ke revo_attend di DB, kembali (header, body)."""
    if request_code == 'realtime_glog':
        parsed = parse_fk_payload(body)
        uid = str(parsed.get('user_id', '')).strip()
        ts = format_io_time(parsed.get('io_time', ''))
        if uid and ts:
            baru = simpan_pukulan(uid, ts)
            if baru:
                print(f"[GLOG MASUK DB] user:{uid} time:{ts}", flush=True)
        return _balasan(str(trans_id or '0'))

    elif request_code == 'realtime_enroll_data':
        parsed = parse_fk_payload(body)
        uid = str(parsed.get('user_id', '')).strip()
        nama = str(parsed.get('user_name', '')).strip()
        if uid and nama:
            set_user_nama(uid, nama)
            print(f"[ENROLL DITERIMA] user:{uid} name:{nama}", flush=True)
        return _balasan(str(trans_id or '0'))

    elif request_code == 'receive_cmd':
        return _balasan(str(trans_id or '0'))

    return _balasan(str(trans_id or '0'))


def ambil_attlog(target: date, jam_mulai: int, jam_akhir: int) -> dict:
    """Kontrak n8n: {ok, records[{user_id,nama,timestamp}], info} — urut naik dari revo_attend."""
    mulai, akhir = compute_window(target, jam_mulai, jam_akhir)
    batas_bawah, batas_atas = mulai.strftime(WAKTU), akhir.strftime(WAKTU)

    with SessionLocal() as db:
        users = {u.user_id: u.name for u in db.scalars(select(RevoUser)).all()}
        total = db.scalar(select(func.count()).select_from(RevoAttend)) or 0
        baris = db.scalars(
            select(RevoAttend)
            .where(RevoAttend.timestamp >= batas_bawah, RevoAttend.timestamp <= batas_atas)
            .order_by(RevoAttend.timestamp.asc())
        ).all()

    records = [
        {'user_id': r.user_id, 'nama': users.get(r.user_id, ''), 'timestamp': r.timestamp}
        for r in baris
    ]

    return {
        'ok': True,
        'records': records,
        'info': {
            'port': settings.revo_fksdk_port,
            'start': batas_bawah,
            'end': batas_atas,
            'target_date': target.isoformat(),
            'users': 0,
            'total_device': total,
            'di_jendela': len(records),
            'buruk_waktu': 0,
        },
    }
