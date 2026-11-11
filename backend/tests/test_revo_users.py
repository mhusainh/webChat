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

    def test_ubah_user_id_memindahkan_riwayat(self):
        t = token()
        push_glog('9901', '20260117070000')

        ubah = client.put(
            '/api/revo/users/9901',
            json={'name': 'Uji Ganti', 'role': 'Karyawan', 'user_id': '9902'},
            headers=hdr(t),
        )
        assert ubah.status_code == 200
        assert ubah.json()['user_id'] == '9902'

        # riwayat ikut berpindah ke User ID baru, join nama tetap utuh
        rows = [
            r
            for r in client.get('/api/revo/riwayat', headers=hdr(t)).json()
            if r['nama'] == 'Uji Ganti'
        ]
        assert [r['user_id'] for r in rows] == ['9902']
        daftar = client.get('/api/revo/users', headers=hdr(t)).json()
        assert all(r['user_id'] != '9901' for r in daftar)

        # bentrok dengan User ID pekerja lain = 409
        push_glog('9903', '20260117070100')
        assert client.put(
            '/api/revo/users/9903',
            json={'name': 'X', 'role': '', 'user_id': '9902'},
            headers=hdr(t),
        ).status_code == 409

        # format tidak valid = 422, bukan 500
        assert client.put(
            '/api/revo/users/9902',
            json={'name': 'X', 'role': '', 'user_id': 'spasi tidak'},
            headers=hdr(t),
        ).status_code == 422

        # tanpa field user_id: ganti nama/peran saja, id tetap
        ubah2 = client.put(
            '/api/revo/users/9902', json={'name': 'Tetap', 'role': 'Staff'}, headers=hdr(t)
        )
        assert ubah2.status_code == 200
        assert ubah2.json()['user_id'] == '9902'


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
        assert client.delete('/api/revo/riwayat/1').status_code == 401

    def test_hapus_satu_baris_riwayat_menyisakan_pekerja(self):
        t = token()
        push_glog('9501', '20260113070000')
        push_glog('9501', '20260113080000')
        baris = [r for r in client.get('/api/revo/riwayat', headers=hdr(t)).json() if r['user_id'] == '9501']
        assert len(baris) == 2
        assert all(isinstance(r['id'], int) for r in baris)

        # baris terbaru (index 0) dihapus — hanya catatannya
        assert client.delete(f"/api/revo/riwayat/{baris[0]['id']}", headers=hdr(t)).status_code == 204
        sisa = [r for r in client.get('/api/revo/riwayat', headers=hdr(t)).json() if r['user_id'] == '9501']
        assert [r['timestamp'] for r in sisa] == ['2026-01-13 07:00:00']

        # pekerja di revo_users tidak ikut terhapus
        daftar = client.get('/api/revo/users', headers=hdr(t)).json()
        assert any(r['user_id'] == '9501' for r in daftar)

        # hapus baris terakhir: riwayat kosong, pekerja tetap ada
        assert client.delete(f"/api/revo/riwayat/{sisa[0]['id']}", headers=hdr(t)).status_code == 204
        assert all(r['user_id'] != '9501' for r in client.get('/api/revo/riwayat', headers=hdr(t)).json())
        daftar = client.get('/api/revo/users', headers=hdr(t)).json()
        assert any(r['user_id'] == '9501' for r in daftar)

        assert client.delete(f"/api/revo/riwayat/{baris[0]['id']}", headers=hdr(t)).status_code == 404


class TestRiwayatFilter:
    def test_cari_nama_dan_filter_peran(self):
        t = token()
        client.post(
            '/api/revo/users',
            json={'user_id': '9601', 'name': 'Budi Santoso', 'role': 'Teknisi'},
            headers=hdr(t),
        )
        client.post(
            '/api/revo/users',
            json={'user_id': '9602', 'name': 'siti rahayu', 'role': 'Operator'},
            headers=hdr(t),
        )
        push_glog('9601', '20260114070000')
        push_glog('9602', '20260114070100')

        # search nama: huruf besar-kecil bebas, cocok sebagian
        budi = client.get('/api/revo/riwayat', params={'search': 'budi'}, headers=hdr(t)).json()
        assert [r['user_id'] for r in budi] == ['9601']
        siti = client.get('/api/revo/riwayat', params={'search': 'RAHAYU'}, headers=hdr(t)).json()
        assert [r['user_id'] for r in siti] == ['9602']
        kosong = client.get('/api/revo/riwayat', params={'search': 'tak-ada'}, headers=hdr(t)).json()
        assert kosong == []

        # filter peran (cocok persis) — kedua user di atas sudah berperan
        op = client.get('/api/revo/riwayat', params={'role': 'Operator'}, headers=hdr(t)).json()
        assert [r['user_id'] for r in op] == ['9602']
        # role='' berarti hanya yang tanpa peran
        assert client.get('/api/revo/riwayat', params={'role': ''}, headers=hdr(t)).json() == []

    def test_filter_rentang_tanggal(self):
        t = token()
        push_glog('9701', '20260114070000')
        push_glog('9701', '20260115070000')
        push_glog('9701', '20260116070000')

        rentang = client.get(
            '/api/revo/riwayat',
            params={'date_from': '2026-01-14', 'date_to': '2026-01-15'},
            headers=hdr(t),
        ).json()
        assert [r['timestamp'] for r in rentang] == ['2026-01-15 07:00:00', '2026-01-14 07:00:00']

        # hanya batas bawah
        dari = client.get(
            '/api/revo/riwayat', params={'date_from': '2026-01-16'}, headers=hdr(t)
        ).json()
        assert [r['timestamp'] for r in dari] == ['2026-01-16 07:00:00']

        # tanggal tidak valid = 400, bukan 500
        assert client.get(
            '/api/revo/riwayat', params={'date_from': '16-01-2026'}, headers=hdr(t)
        ).status_code == 400
        assert client.get(
            '/api/revo/riwayat', params={'date_to': '2026-02-30'}, headers=hdr(t)
        ).status_code == 400

    def test_urut_nama_dan_tanggal_serta_validasi_sort(self):
        t = token()
        client.post(
            '/api/revo/users', json={'user_id': '9801', 'name': 'Zara', 'role': ''}, headers=hdr(t)
        )
        client.post(
            '/api/revo/users', json={'user_id': '9802', 'name': 'Alpha', 'role': ''}, headers=hdr(t)
        )
        push_glog('9801', '20260114070000')
        push_glog('9802', '20260114070100')

        asc = client.get('/api/revo/riwayat', params={'sort': 'name_asc'}, headers=hdr(t)).json()
        assert [r['nama'] for r in asc] == ['Alpha', 'Zara']
        desc = client.get('/api/revo/riwayat', params={'sort': 'name_desc'}, headers=hdr(t)).json()
        assert [r['nama'] for r in desc] == ['Zara', 'Alpha']
        waktu = client.get('/api/revo/riwayat', params={'sort': 'time_asc'}, headers=hdr(t)).json()
        assert [r['timestamp'] for r in waktu] == ['2026-01-14 07:00:00', '2026-01-14 07:01:00']

        assert client.get(
            '/api/revo/riwayat', params={'sort': 'asal'}, headers=hdr(t)
        ).status_code == 400
