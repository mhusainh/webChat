"""Uji CRUD revo_users (JWT) + riwayat join revo_attend x revo_users."""

import json
import struct

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.revo_fksdk import reset_memory

client = TestClient(app)

HUSAIN = {'username': 'husain', 'password': '123'}


@pytest.fixture(autouse=True)
def bersihkan():
    reset_memory()
    yield
    reset_memory()


def token() -> str:
    resp = client.post('/api/auth/login', json=HUSAIN)
    assert resp.status_code == 200, resp.text
    return resp.json()['access_token']


def hdr(t: str) -> dict:
    return {'Authorization': f'Bearer {t}'}


def push_glog(uid: str, waktu: str) -> None:
    """waktu format mesin: YYYYMMDDhhmmss."""
    isi = json.dumps({'io_time': waktu, 'user_id': uid, 'fk_bin_data_lib': 'FKDataHS103'}).encode('utf-8')
    resp = client.post(
        '/api/revo/push',
        content=struct.pack('<I', len(isi)) + isi,
        headers={
            'request_code': 'realtime_glog',
            'dev_id': 'C261B8D81B280B23',
            'trans_id': '1',
            'Content-Type': 'application/octet-stream',
        },
    )
    assert resp.status_code == 200


class TestCRUDRevoUsers:
    def test_wajib_login(self):
        assert client.get('/api/revo/users').status_code == 401
        assert client.post('/api/revo/users', json={'user_id': '1', 'name': 'X'}).status_code == 401

    def test_baca_tambah_ubah_hapus(self):
        t = token()
        assert client.get('/api/revo/users', headers=hdr(t)).status_code == 200

        resp = client.post(
            '/api/revo/users',
            json={'user_id': '9101', 'name': 'Budi', 'role': 'Teknisi'},
            headers=hdr(t),
        )
        assert resp.status_code == 201
        assert resp.json()['user_id'] == '9101'
        assert resp.json()['name'] == 'Budi'
        assert resp.json()['role'] == 'Teknisi'

        duplikat = client.post(
            '/api/revo/users',
            json={'user_id': '9101', 'name': 'Lain', 'role': ''},
            headers=hdr(t),
        )
        assert duplikat.status_code == 409

        daftar = client.get('/api/revo/users', headers=hdr(t)).json()
        assert any(r['user_id'] == '9101' and r['name'] == 'Budi' for r in daftar)

        ubah = client.put(
            '/api/revo/users/9101',
            json={'name': 'Budi Santoso', 'role': 'Kepala Regu'},
            headers=hdr(t),
        )
        assert ubah.status_code == 200
        assert ubah.json()['name'] == 'Budi Santoso'
        assert ubah.json()['role'] == 'Kepala Regu'

        assert client.put(
            '/api/revo/users/9999',
            json={'name': 'Tidak Ada', 'role': ''},
            headers=hdr(t),
        ).status_code == 404

        assert client.delete('/api/revo/users/9101', headers=hdr(t)).status_code == 204
        daftar = client.get('/api/revo/users', headers=hdr(t)).json()
        assert all(r['user_id'] != '9101' for r in daftar)
        assert client.delete('/api/revo/users/9101', headers=hdr(t)).status_code == 404


class TestRiwayatKedatangan:
    def test_scan_otomatis_buat_user_lalu_join_nama(self):
        t = token()
        push_glog('9201', '20260110070015')

        rows = client.get('/api/revo/riwayat', headers=hdr(t)).json()
        assert rows[0]['user_id'] == '9201'
        assert rows[0]['nama'] == 'Belum Diberi Nama'
        assert rows[0]['timestamp'] == '2026-01-10 07:00:15'

        client.put('/api/revo/users/9201', json={'name': 'Siti', 'role': 'Operator'}, headers=hdr(t))
        rows = client.get('/api/revo/riwayat', headers=hdr(t)).json()
        assert rows[0]['nama'] == 'Siti'
        assert rows[0]['role'] == 'Operator'

    def test_urut_terbaru_dulu_dan_filter_tanggal(self):
        t = token()
        push_glog('9301', '20260110070000')
        push_glog('9301', '20260111070000')

        rows = client.get('/api/revo/riwayat', headers=hdr(t)).json()
        stamps = [r['timestamp'] for r in rows]
        assert stamps == sorted(stamps, reverse=True)

        hari = client.get(
            '/api/revo/riwayat', params={'target_date': '2026-01-10'}, headers=hdr(t)
        ).json()
        assert [r['timestamp'] for r in hari] == ['2026-01-10 07:00:00']

        assert client.get(
            '/api/revo/riwayat', params={'target_date': '10-01-2026'}, headers=hdr(t)
        ).status_code == 400

    def test_hapus_user_menghapus_riwayatnya(self):
        t = token()
        push_glog('9401', '20260112070000')
        assert any(r['user_id'] == '9401' for r in client.get('/api/revo/riwayat', headers=hdr(t)).json())

        assert client.delete('/api/revo/users/9401', headers=hdr(t)).status_code == 204
        assert all(r['user_id'] != '9401' for r in client.get('/api/revo/riwayat', headers=hdr(t)).json())

    def test_riwayat_wajib_login(self):
        assert client.get('/api/revo/riwayat').status_code == 401
