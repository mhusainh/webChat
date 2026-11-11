"""Uji Revo: push FKSDK -> in-memory (NOL database) -> kontrak /api/revo/attlog."""

import json
import socket
import struct

import httpx
import pytest
from fastapi.testclient import TestClient

from app import config as app_config
from app.fksdk_server import berhenti, mulai
from app.main import app
from app.revo_fksdk import reset_memory

client = TestClient(app)

@pytest.fixture(autouse=True)
def bersihkan_ram():
    reset_memory()
    yield
    reset_memory()

DEV_A = 'C261B8D81B280B23'
DEV_B = 'C268940867343332'


def _badan(payload: dict) -> bytes:
    """Body FKSDK: 4-byte panjang (LE) + JSON."""
    isi = json.dumps(payload).encode('utf-8')
    return struct.pack('<I', len(isi)) + isi


def push(request_code: str, payload: dict, dev_id: str = DEV_A, trans_id: str = '7'):
    return client.post(
        '/api/revo/push',
        content=_badan(payload),
        headers={
            'request_code': request_code,
            'dev_id': dev_id,
            'trans_id': trans_id,
            'Content-Type': 'application/octet-stream',
        },
    )


def glog(uid: str, waktu: str) -> dict:
    """waktu format mesin: YYYYMMDDhhmmss."""
    return {
        'fk_bin_data_lib': 'FKDataHS103',
        'io_mode': 16777216,
        'io_time': waktu,
        'log_image': None,
        'timezone': '+07:00',
        'user_id': uid,
        'verify_mode': 268435456,
    }


def attlog(target: str, **params):
    return client.get('/api/revo/attlog', params={'target_date': target, **params})


class TestPushFKSDK:
    def test_denyut_jantung_dibalas_ok(self):
        resp = push('receive_cmd', {'fk_name': 'Fingerspot'}, trans_id='99')
        assert resp.status_code == 200
        assert resp.headers['response_code'] == 'OK'
        assert resp.headers['trans_id'] == '99'

    def test_glog_masuk_lalu_terbaca(self):
        push('realtime_glog', glog('501', '20260101070015'))

        body = attlog('2026-01-01').json()
        assert body['ok'] is True
        assert body['records'][0]['user_id'] == '501'
        assert body['records'][0]['timestamp'] == '2026-01-01 07:00:15'
        assert body['info']['di_jendela'] == 1
        assert body['info']['start'] == '2026-01-01 00:00:00'
        assert body['info']['end'] == '2026-01-02 08:00:00'

    def test_urutan_naik(self):
        push('realtime_glog', glog('502', '20260102170000'))
        push('realtime_glog', glog('502', '20260102070000'))
        stamps = [r['timestamp'] for r in attlog('2026-01-02').json()['records']]
        assert stamps == sorted(stamps)
        assert stamps[0].endswith('07:00:00')

    def test_duplikat_perangkat_sama_dibuang(self):
        push('realtime_glog', glog('503', '20260103070000'))
        push('realtime_glog', glog('503', '20260103070000'))
        assert len(attlog('2026-01-03').json()['records']) == 1

    def test_dua_perangkat_pukulan_sama_satu_baris(self):
        push('realtime_glog', glog('504', '20260104070000'), dev_id=DEV_A)
        push('realtime_glog', glog('504', '20260104070000'), dev_id=DEV_B)
        assert len(attlog('2026-01-04').json()['records']) == 1


class TestJendelaWaktu:
    def test_sebelum_jendela_dibuang(self):
        push('realtime_glog', glog('601', '20251231235959'))
        assert attlog('2026-01-10').json()['records'] == []

    def test_sampai_0800_masuk_0801_keluar(self):
        # Cutoff 08:00 berlaku di D+1, bukan di D (D seluruhnya masuk jendela).
        push('realtime_glog', glog('602', '20260112075959'))
        push('realtime_glog', glog('602', '20260112080000'))
        push('realtime_glog', glog('602', '20260112080001'))
        stamps = [r['timestamp'] for r in attlog('2026-01-11').json()['records']]
        assert stamps == ['2026-01-12 07:59:59', '2026-01-12 08:00:00']


class TestValidasi:
    def test_target_date_salah(self):
        resp = attlog('10-01-2026')
        assert resp.status_code == 400
        assert resp.json()['ok'] is False
        assert resp.json()['error'].startswith('TARGET_DATE_TIDAK_VALID')

    def test_jam_salah(self):
        resp = attlog('2026-02-01', jam_mulai=99)
        assert resp.status_code == 400
        assert resp.json()['error'].startswith('JAM_MULAI_TIDAK_VALID')

    def test_kunci_api_dihormati(self):
        lama = app_config.settings.revo_api_key
        try:
            app_config.settings.revo_api_key = 'rahasia'
            assert attlog('2026-03-01').status_code == 401
            ok = client.get(
                '/api/revo/attlog',
                params={'target_date': '2026-03-01'},
                headers={'X-API-Key': 'rahasia'},
            )
            assert ok.status_code == 200
            assert ok.json()['ok'] is True
        finally:
            app_config.settings.revo_api_key = lama

    def test_push_tidak_butuh_kunci(self):
        lama = app_config.settings.revo_api_key
        try:
            app_config.settings.revo_api_key = 'rahasia'
            assert push('receive_cmd', {}).status_code == 200
        finally:
            app_config.settings.revo_api_key = lama


class TestSetNama:
    def test_set_nama_endpoint(self):
        assert client.put('/api/revo/users', json={'user_id': '701', 'nama': 'Agus Wijaya'}).json()['ok'] is True


class TestListener8014:
    def _port_bebas(self) -> int:
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            return s.getsockname()[1]

    def test_perangkat_bisa_menulis_lewat_port_terpisah(self):
        port = self._port_bebas()
        assert mulai(port, host='127.0.0.1') is True
        try:
            resp = httpx.post(
                f'http://127.0.0.1:{port}/',
                content=_badan(glog('801', '20260501070000')),
                headers={
                    'request_code': 'realtime_glog',
                    'dev_id': DEV_A,
                    'trans_id': '42',
                    'Content-Type': 'application/octet-stream',
                },
                timeout=5,
            )
            assert resp.status_code == 200
            assert resp.headers['response_code'] == 'OK'
            assert resp.headers['trans_id'] == '42'
            assert any(r['timestamp'] == '2026-05-01 07:00:00' for r in attlog('2026-05-01').json()['records'])
        finally:
            berhenti()

    def test_gagal_buka_port_tidak_menghentikan_aplikasi(self):
        # Bind ke IP yang bukan milik kita -> OSError, listener gagal tapi app tetap hidup.
        assert mulai(8014, host='192.0.2.1') is False
        berhenti()
