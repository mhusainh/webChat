"""Penyimpan koneksi WebSocket frontend + siaran realtime ke semua klien."""

import json

from fastapi import WebSocket


class WsManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        """Kirim ke semua klien; koneksi mati dibuang supaya tidak memblokir."""
        data = json.dumps(message, ensure_ascii=False)
        for client in list(self._clients):
            try:
                await client.send_text(data)
            except Exception:
                self._clients.discard(client)


manager = WsManager()
