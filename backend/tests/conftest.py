"""Siapkan tabel + seed user sebelum test jalan (tanpa lifespan server)."""

from app.database import Base, SessionLocal, engine
from app.main import seed_users

Base.metadata.create_all(bind=engine)
seed_users()
