"""Siapkan tabel + seed user sebelum test jalan (tanpa lifespan server).

DATABASE_URL diarahkan ke SQLite sementara SEBELUM app.diimpor, supaya test
bisa jalan walau Postgres lokal sedang mati. Set `TEST_DATABASE_URL` dari luar
untuk memaksa database lain (mis. Postgres).
"""

import os
import tempfile
from pathlib import Path

_uji = os.environ.get('TEST_DATABASE_URL')
if not _uji:
    _berkas = Path(tempfile.gettempdir()) / 'webchat_test.db'
    if _berkas.exists():
        _berkas.unlink()
    _uji = f'sqlite:///{_berkas.as_posix()}'
os.environ['DATABASE_URL'] = _uji

from app.database import Base, engine  # noqa: E402
from app.main import seed_users  # noqa: E402

Base.metadata.create_all(bind=engine)
seed_users()
