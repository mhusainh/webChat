"""Test endpoint trigger — httpx di-mock, tidak butuh n8n beneran."""

from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)

HUSAIN = {'username': 'husain', 'password': '123'}


def auth_header() -> dict:
    r = client.post('/api/auth/login', json=HUSAIN)
    assert r.status_code == 200
    return {'Authorization': f"Bearer {r.json()['access_token']}"}


class _FakeResponse:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code


class TestTrigger:
    def test_trigger_requires_token(self):
        resp = client.post('/api/trigger', json={'jenis': 'test', 'data': 'test payload'})
        assert resp.status_code == 401

    def test_trigger_unconfigured_returns_503(self):
        with patch.object(settings, 'n8n_webhook_url', ''):
            resp = client.post(
                '/api/trigger',
                json={'jenis': 'test', 'data': 'test payload'},
                headers=auth_header(),
            )
        assert resp.status_code == 503

    def test_trigger_forwards_payload_to_n8n(self):
        captured = {}

        def fake_post(url, json=None, timeout=None):
            captured['url'] = url
            captured['json'] = json
            captured['timeout'] = timeout
            return _FakeResponse(200)

        with patch.object(settings, 'n8n_webhook_url', 'http://n8n.test/webhook/x'), \
                patch('app.routers.trigger.httpx.post', side_effect=fake_post):
            resp = client.post(
                '/api/trigger',
                json={'jenis': 'order_baru', 'data': 'order #101 total 250000'},
                headers=auth_header(),
            )

        assert resp.status_code == 200
        assert resp.json() == {'status': 'terkirim', 'n8n_status': 200, 'detail': None}
        assert captured['url'] == 'http://n8n.test/webhook/x'
        assert captured['json']['jenis'] == 'order_baru'
        assert captured['json']['data'] == 'order #101 total 250000'
        # siapa yang trigger ikut terkirim
        assert captured['json']['user'] == 'husain'

    def test_trigger_n8n_error_returns_502(self):
        with patch.object(settings, 'n8n_webhook_url', 'http://n8n.test/webhook/x'), \
                patch('app.routers.trigger.httpx.post', return_value=_FakeResponse(500)):
            resp = client.post(
                '/api/trigger',
                json={'jenis': 'test', 'data': 'test payload'},
                headers=auth_header(),
            )
        assert resp.status_code == 502

    def test_trigger_n8n_unreachable_returns_502(self):
        with patch.object(settings, 'n8n_webhook_url', 'http://n8n.test/webhook/x'), \
                patch('app.routers.trigger.httpx.post', side_effect=httpx.ConnectError('refused')):
            resp = client.post(
                '/api/trigger',
                json={'jenis': 'test', 'data': 'test payload'},
                headers=auth_header(),
            )
        assert resp.status_code == 502

    def test_trigger_jenis_required(self):
        resp = client.post('/api/trigger', json={'data': {}}, headers=auth_header())
        assert resp.status_code == 422
