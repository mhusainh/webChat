from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import select

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, trigger, users
from app.security import hash_password

# User awal yang dibuat otomatis saat database kosong: (username, password)
SEED_USERS = [
    (settings.seed_username, settings.seed_password),
    ('husain', '123'),
]


def seed_users() -> None:
    with SessionLocal() as db:
        for username, password in SEED_USERS:
            exists = db.scalar(select(User).where(User.username == username))
            if exists is None:
                db.add(User(username=username, password=hash_password(password)))
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_users()
    yield


app = FastAPI(title='User Manager', version='1.1.0', lifespan=lifespan)

app.include_router(auth.router, prefix='/api')
app.include_router(users.router, prefix='/api')
app.include_router(trigger.router, prefix='/api')


@app.get('/health')
def health():
    return {'status': 'ok'}
