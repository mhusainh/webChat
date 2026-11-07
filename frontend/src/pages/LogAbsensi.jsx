import { useCallback, useEffect, useState } from "react";
import { api, pesanApi } from "../api";
import { formatWaktu, isiResponse } from "../format";

const pad2 = (n) => String(n).padStart(2, "0");

export default function LogAbsensiPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const muat = useCallback(async (opts = {}) => {
    if (!opts.silent) {
      setStatus("loading");
      setLoadError("");
    }
    try {
      const data = await api(`/responses?jenis=${encodeURIComponent("/absensi")}&limit=500`);
      setItems(data);
      setStatus("ready");
    } catch (err) {
      setLoadError(pesanApi(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- muat({silent:true}) tidak men-set apa pun secara sinkron; status loading sudah jadi state awal
    muat({ silent: true });
  }, [muat]);

  const gagal = items.filter((r) => r.status === "failed").length;

  return (
    <>
      <main className="work">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <div className="head">
          <div>
            <span className="sec-label">Seksi 04 · Lembar 04/04</span>
            <h1>Log Absensi</h1>
          </div>
          <button type="button" className="btn" onClick={muat} disabled={status === "loading"}>
            {status === "loading" ? "Memuat…" : "Muat ulang"}
          </button>
        </div>

        <div className="stats" aria-label="Ringkasan log">
          <div className="stat">
            <span className="k">Total laporan</span>
            <span className="v">{status === "ready" ? pad2(items.length) : "—"}</span>
          </div>
          <div className="stat">
            <span className="k">Gagal</span>
            <span className="v">{status === "ready" ? pad2(gagal) : "—"}</span>
          </div>
        </div>

        <div className="logbox no-resize" role="log" aria-label="Log otomasi absensi">
          {status === "loading" && <p className="log-info">Memuat log…</p>}
          {status === "error" && (
            <p className="log-info">
              {loadError || "Gagal memuat dari server."}{" "}
              <button type="button" className="log-retry" onClick={muat}>
                Muat ulang
              </button>
            </p>
          )}
          {status === "ready" && items.length === 0 && (
            <p className="log-info">Belum ada laporan otomasi absensi.</p>
          )}
          {status === "ready" &&
            items.map((r) => (
              <div className={`log-row ${r.status === "success" ? "ok" : "err"}`} key={r.id}>
                <div className="log-head">
                  <span className="log-time">{formatWaktu(r.created_at)}</span>
                  <span className="log-st">{r.status === "success" ? "SUCCESS" : "FAILED"}</span>
                </div>
                <pre className="log-body">{isiResponse(r.response)}</pre>
              </div>
            ))}
        </div>
      </main>

      <aside className="aside">
        <span className="k">Lembar sisipan · catatan</span>

        <div className="sheetlet">
          <h2>Tentang Log Ini</h2>
          <p style={{ marginBottom: 12 }}>
            Halaman ini memantau <b>otomasi absensi di n8n</b>. Tiap baris adalah laporan status: <b>SUCCESS</b> berarti
            langkah berjalan sebagaimana mestinya, <b>FAILED</b> berarti error.
          </p>
          <p style={{ marginBottom: 12 }}>
            Absensi berjalan otomatis, bukan ditrigger manual. Halaman ini pun tidak punya tombol kirim maupun
            WebSocket. Data dibaca dari database; tekan <b>Muat ulang</b> untuk menyegarkan.
          </p>
          <p className="jenis-code">
            SUMBER → TABEL RESPONS · JENIS /ABSENSI
            <br />
            SEGAR → MUAT ULANG MANUAL
          </p>
        </div>
      </aside>
    </>
  );
}
