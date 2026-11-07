"""Test endpoint responses — wajib tersimpan ke DB, tampil di GET, dan disiarkan WS."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from starlette.websockets import WebSocketDisconnect

from app.database import SessionLocal
from app.main import app
from app.models import Responses

client = TestClient(app)
HUSAIN = {'username': 'husain', 'password': '123'}


def auth_header() -> dict:
    r = client.post('/api/auth/login', json=HUSAIN)
    assert r.status_code == 200
    return {'Authorization': f"Bearer {r.json()['access_token']}"}


def hapus(*ids: int) -> None:
    with SessionLocal() as db:
        db.execute(delete(Responses).where(Responses.id.in_(ids)))
        db.commit()


class TestResponses:
    def test_post_penyimpanan_dan_siaran_ws(self):
        token = auth_header().get('Authorization').split()[1]
        with client.websocket_connect(f'/ws?token={token}') as ws:
            resp = client.post(
                '/api/responses',
                json={'jenis': '/rab', 'status': 'success', 'response': {'step': 'ocr'}},
            )
            assert resp.status_code == 201, resp.text
            body = resp.json()
            assert body['jenis'] == '/rab'
            assert body['status'] == 'success'
            assert body['response'] == {'step': 'ocr'}
            assert body['created_at']

            pesan = ws.receive_json()
            assert pesan['type'] == 'response'
            assert pesan['data']['id'] == body['id']
            assert pesan['data']['status'] == 'success'
        hapus(body['id'])

    def test_post_gagal_diterima_dan_tersimpan(self):
        resp = client.post(
            '/api/responses',
            json={'jenis': '/jadwal', 'status': 'failed', 'response': {'pesan': 'n8n timeout'}},
        )
        assert resp.status_code == 201
        body = resp.json()
        header = auth_header()
        daftar = client.get('/api/responses?jenis=/jadwal', headers=header)
        assert daftar.status_code == 200
        assert any(item['id'] == body['id'] for item in daftar.json())
        hapus(body['id'])

    def test_post_status_atau_jenis_tidak_dikenal_ditolak(self):
        assert client.post(
            '/api/responses', json={'jenis': '/rab', 'status': 'pending'}
        ).status_code == 422
        assert client.post(
            '/api/responses', json={'jenis': '/gaji', 'status': 'success'}
        ).status_code == 422

    def test_get_urut_terbaru_dan_saring_jenis(self):
        id_lama = client.post(
            '/api/responses',
            json={'jenis': '/rab', 'status': 'failed', 'response': {'n': 'lama'}},
        ).json()['id']
        id_baru = client.post(
            '/api/responses',
            json={'jenis': '/rab', 'status': 'success', 'response': {'n': 'baru'}},
        ).json()['id']
        try:
            header = auth_header()
            resp = client.get('/api/responses?jenis=/rab', headers=header)
            assert resp.status_code == 200
            ids = [item['id'] for item in resp.json()]
            assert ids.index(id_baru) < ids.index(id_lama), 'terbaru harus di atas'
            assert all(item['jenis'] == '/rab' for item in resp.json())
        finally:
            hapus(id_baru, id_lama)

    def test_get_butuh_token(self):
        assert client.get('/api/responses').status_code == 401

    def test_ws_tolak_token_salah(self):
        with pytest.raises(WebSocketDisconnect) as err:
            with client.websocket_connect('/ws?token=salah'):
                pass
        assert err.value.code == 4401
