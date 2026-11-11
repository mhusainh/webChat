"""Listener FKSDK 0.0.0.0:8014 — jalur asli perangkat Fingerspot Revo.

Berjalan sebagai thread daemon di dalam proses backend, jadi tidak ada layanan
terpisah yang harus dijaga. Gagal membuka port (misal masih dipegang
revo_server.py lama) hanya dicatat, backend tetap hidup tanpa listener Revo.
"""

import logging
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from app.revo_fksdk import process_push

logger = logging.getLogger('revo.fksdk')

_server: ThreadingHTTPServer | None = None
_thread: threading.Thread | None = None


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # senyap — satu baris per denyut jantung
        pass

    def do_POST(self):
        panjang = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(panjang) if panjang else b''
        headers, balasan = process_push(
            self.headers.get('request_code', ''),
            self.headers.get('dev_id', ''),
            self.headers.get('trans_id', '0'),
            body,
        )
        self.send_response(200)
        for nama, nilai in headers.items():
            self.send_header(nama, nilai)
        self.send_header('Content-Length', str(len(balasan)))
        self.send_header('Connection', 'close')
        self.end_headers()
        if balasan:
            self.wfile.write(balasan)
            self.wfile.flush()


def mulai(port: int, host: str = '0.0.0.0') -> bool:
    global _server, _thread
    if _server is not None:
        return True
    try:
        _server = ThreadingHTTPServer((host, port), _Handler)
    except OSError as exc:
        logger.warning('Port FKSDK %s tidak bisa dibuka (%s); backend jalan tanpa listener Revo.', port, exc)
        return False
    _server.daemon_threads = True
    _thread = threading.Thread(target=_server.serve_forever, name='fksdk-revo', daemon=True)
    _thread.start()
    logger.info('Listener FKSDK Revo aktif di %s:%s', host, port)
    return True


def berhenti() -> None:
    global _server, _thread
    if _server is None:
        return
    _server.shutdown()
    _server.server_close()
    _server = None
    _thread = None
