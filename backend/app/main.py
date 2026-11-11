from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app import fksdk_server
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, karyawan_khusus, responses, revo, trigger, users
from app.security import decode_access_token, hash_password
from app.ws import manager

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
    if settings.revo_fksdk_enabled:
        fksdk_server.mulai(settings.revo_fksdk_port)
    yield
    fksdk_server.berhenti()


app = FastAPI(title='User Manager', version='1.1.0', lifespan=lifespan)

app.include_router(auth.router, prefix='/api')
app.include_router(users.router, prefix='/api')
app.include_router(karyawan_khusus.router, prefix='/api')
app.include_router(trigger.router, prefix='/api')
app.include_router(responses.router, prefix='/api')
app.include_router(revo.router, prefix='/api')


@app.websocket('/ws')
async def ws_status(websocket: WebSocket, token: str = Query(default='')):
    """Gateway realtime: baris baru dari POST /api/responses disiarkan ke klien ini."""
    if not decode_access_token(token):
        await websocket.close(code=4401)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


@app.get('/health')
def health():
    return {'status': 'ok'}
