import { useCallback, useEffect, useRef, useState } from "react";
import { api, tokenStore } from "./api";

const JUMLAH_MUAT = 500;

function wsUrl() {
  const base = import.meta.env.VITE_API_BASE || "/api";
  if (/^https?:\/\//.test(base)) {
    const u = new URL(base);
    u.pathname = "/ws";
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.toString();
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

function gabung(lama, baru) {
  const peta = new Map();
  for (const baris of [...lama, ...baru]) peta.set(baris.id, baris);
  return [...peta.values()].sort((a, b) => b.id - a.id);
}

// Riwayat + siaran realtime /api/responses. WS menyimpan semua jenis;
// penyaringan jenis dilakukan di komponen pemakai.
export default function useResponses(jenis) {
  const [items, setItems] = useState([]);
  const [muat, setMuat] = useState({ state: "loading", jenis });
  const [koneksi, setKoneksi] = useState("connecting");
  const jenisRef = useRef(jenis);

  // Sinkronkan sebelum efek muatRiwayat (urutan efek: ini dulu, lalu muat).
  useEffect(() => {
    jenisRef.current = jenis;
  }, [jenis]);

  const muatRiwayat = useCallback(async () => {
    const untuk = jenisRef.current;
    setMuat({ state: "loading", jenis: untuk });
    try {
      const data = await api(
        `/responses?jenis=${encodeURIComponent(untuk)}&limit=${JUMLAH_MUAT}`
      );
      setItems((prev) => gabung(prev, data));
      setMuat({ state: "ready", jenis: untuk });
    } catch {
      setMuat({ state: "error", jenis: untuk });
    }
  }, []);

  useEffect(() => {
    muatRiwayat();
  }, [jenis, muatRiwayat]);

  useEffect(() => {
    let mati = false;
    let ws = null;
    let timer = null;
    let percobaan = 0;

    const jadwalUlang = () => {
      percobaan += 1;
      const tunggu = Math.min(1000 * percobaan, 8000);
      timer = setTimeout(sambung, tunggu);
    };

    const sambung = () => {
      if (mati) return;
      const token = tokenStore.access;
      if (!token) {
        setKoneksi("down");
        return;
      }
      setKoneksi((k) => (k === "live" ? k : "connecting"));
      try {
        ws = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
      } catch {
        jadwalUlang();
        return;
      }
      ws.onopen = () => {
        // Sudah dibongkar saat masih CONNECTING: tutup sekarang (bukan di
        // cleanup — close() di status CONNECTING memancing warning console).
        if (mati) {
          ws.close();
          return;
        }
        percobaan = 0;
        setKoneksi("live");
        muatRiwayat();
      };
      ws.onmessage = (ev) => {
        if (mati) return;
        try {
          const pesan = JSON.parse(ev.data);
          if (pesan.type === "response" && pesan.data) {
            setItems((prev) => gabung(prev, [pesan.data]));
          }
        } catch {
          // pesan tidak terbaca, abaikan
        }
      };
      ws.onerror = () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      };
      ws.onclose = () => {
        if (mati) return;
        setKoneksi("down");
        jadwalUlang();
      };
    };

    sambung();
    return () => {
      mati = true;
      clearTimeout(timer);
      // Hanya tutup yang sudah terbuka; yang CONNECTING ditutup di onopen
      // begitu terbuka (lihat guard `mati` di atas).
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [muatRiwayat]);

  return { items, muat, koneksi, muatUlang: muatRiwayat };
}
