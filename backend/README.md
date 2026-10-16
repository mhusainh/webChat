# User Manager API

App sederhana: login (access + refresh token), CRUD user (list/create/delete), ganti password sendiri.
Database: PostgreSQL `telegram_access`, tabel `users` (id, username, password, created_at).

## Menjalankan

```bash
cd backend
pip install -r requirements.txt
python run.py            # atau: uvicorn app.main:app --reload
```

Server: http://127.0.0.1:8000 — docs: http://127.0.0.1:8000/docs

User awal dibuat otomatis saat pertama jalan: `admin`/`admin123` dan `husain`/`123`.

## Endpoint

| Method | Path                        | Auth | Keterangan |
|--------|-----------------------------|------|------------|
| POST   | /api/auth/login             | -    | Login → `access_token` (60 mnt) + `refresh_token` (7 hari) |
| POST   | /api/auth/refresh           | -    | Tukar `refresh_token` → token baru |
| GET    | /api/users                  | JWT  | List semua user |
| POST   | /api/users                  | JWT  | Buat user baru |
| DELETE | /api/users/{id}             | JWT  | Hapus user |
| PUT    | /api/users/me/password      | JWT  | Ganti password sendiri (butuh `old_password`) |

## Test

```bash
cd backend
python -m pytest tests -v
```

13 test: login sukses/gagal, refresh token, list/create/duplicate/delete user, ganti password (benar + salah).
