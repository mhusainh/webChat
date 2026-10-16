"""API tests — login memakai user dummy husain/123, lalu uji semua endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

HUSAIN = {'username': 'husain', 'password': '123'}


def login(**overrides) -> dict:
    resp = client.post('/api/auth/login', json={**HUSAIN, **overrides})
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_header(token: str) -> dict:
    return {'Authorization': f'Bearer {token}'}


class TestAuth:
    def test_login_success(self):
        body = login()
        assert set(body) == {'access_token', 'refresh_token', 'token_type'}
        assert body['token_type'] == 'bearer'
        assert body['access_token']
        assert body['refresh_token']

    def test_login_wrong_password(self):
        resp = client.post('/api/auth/login', json={'username': 'husain', 'password': 'salah'})
        assert resp.status_code == 401

    def test_login_unknown_user(self):
        resp = client.post('/api/auth/login', json={'username': 'tidakada', 'password': 'x'})
        assert resp.status_code == 401

    def test_refresh_token(self):
        body = login()
        resp = client.post('/api/auth/refresh', json={'refresh_token': body['refresh_token']})
        assert resp.status_code == 200
        new = resp.json()
        assert new['access_token']
        assert new['refresh_token']
        # token baru harus bisa dipakai akses API
        assert client.get('/api/users', headers=auth_header(new['access_token'])).status_code == 200

    def test_refresh_with_access_token_rejected(self):
        body = login()
        resp = client.post('/api/auth/refresh', json={'refresh_token': body['access_token']})
        assert resp.status_code == 401


class TestUsers:
    def test_list_users_requires_token(self):
        assert client.get('/api/users').status_code == 401

    def test_list_users_contains_husain(self):
        token = login()['access_token']
        resp = client.get('/api/users', headers=auth_header(token))
        assert resp.status_code == 200
        usernames = [u['username'] for u in resp.json()]
        assert 'husain' in usernames
        # password tidak boleh bocor di response
        assert all('password' not in u for u in resp.json())

    def test_create_user(self):
        token = login()['access_token']
        username = 'unit_test_user'
        # kalau sisa dari run sebelumnya, bersihkan dulu supaya test idempotent
        existing = client.get('/api/users', headers=auth_header(token)).json()
        for u in existing:
            if u['username'] == username:
                client.delete(f"/api/users/{u['id']}", headers=auth_header(token))

        resp = client.post(
            '/api/users',
            json={'username': username, 'password': 'rahasia99'},
            headers=auth_header(token),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body['username'] == username
        assert body['id'] > 0
        assert body['created_at']

    def test_create_duplicate_username(self):
        token = login()['access_token']
        resp = client.post(
            '/api/users',
            json={'username': 'husain', 'password': 'apaaja123'},
            headers=auth_header(token),
        )
        assert resp.status_code == 409

    def test_change_own_password(self):
        # ganti password husain, verifikasi login baru, kembalikan lagi ke 123
        body = login()
        token = body['access_token']

        resp = client.put(
            '/api/users/me/password',
            json={'old_password': '123', 'new_password': '4567'},
            headers=auth_header(token),
        )
        assert resp.status_code == 204

        # login dengan password baru harus sukses
        assert login(password='4567')['access_token']

        # kembalikan ke 123 supaya tidak merusak test lain
        resp = client.put(
            '/api/users/me/password',
            json={'old_password': '4567', 'new_password': '123'},
            headers=auth_header(token),
        )
        assert resp.status_code == 204

    def test_change_password_wrong_old(self):
        token = login()['access_token']
        resp = client.put(
            '/api/users/me/password',
            json={'old_password': 'keliru', 'new_password': 'barulagi1'},
            headers=auth_header(token),
        )
        assert resp.status_code == 400

    def test_delete_user(self):
        token = login()['access_token']
        # buat user sementara lalu hapus
        created = client.post(
            '/api/users',
            json={'username': 'user_dihapus', 'password': 'hapusaja1'},
            headers=auth_header(token),
        ).json()
        resp = client.delete(f"/api/users/{created['id']}", headers=auth_header(token))
        assert resp.status_code == 204
        # pastikan sudah hilang
        assert client.delete(f"/api/users/{created['id']}", headers=auth_header(token)).status_code == 404

    def test_delete_user_requires_token(self):
        assert client.delete('/api/users/1').status_code == 401
