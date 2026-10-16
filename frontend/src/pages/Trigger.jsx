import { useState } from "react";
import { api, pesanApi } from "../api";
import { useAuth } from "../auth";

const CONTOH_JADWAL =
  "Berikut Template dari Jadwal\n\n" +
  "[Hari], [tanggal]\n" +
  "1. [Nama Pekerjaan(wajib)] lokasi [lokasi], ulp [ulp], [mandor] - [supir/kenek] k3 [nama k3] " +
  "lokasi [lokasi k3(default=kantor)], jam [jam(default=7)], [padam/pdm], [Keterangan]\n" +
  "2. Pemeliharaan Trafo lokasi Jl. Merdeka No. 45, ulp Semarang, Budi - Agus k3 Dedi lokasi kantor, " +
  "jam 8, padam, pekerjaan butuh pemadaman 2 jam.";

const CONTOH_RAB = "Tempel teks RAB (rencana anggaran biaya) di sini.";

const jamSekarang = () =>
  new Date()
    .toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();

export default function Trigger() {
  const { user } = useAuth();
  const [jenis, setJenis] = useState("jadwal");
  const [data, setData] = useState("");
  const [kirim, setKirim] = useState({ state: "idle", msg: "", receipt: "" });

  const kode = jenis === "jadwal" ? "/jadwal" : "/rab";
  const kosong = data.trim().length === 0;
  const sedangKirim = kirim.state === "sending";

  const ubahTeks = (e) => {
    setData(e.target.value);
    if (kirim.state === "sent" || kirim.state === "error") {
      setKirim({ state: "idle", msg: "", receipt: "" });
    }
  };

  const pilihJenis = (j) => {
    setJenis(j);
    if (kirim.state === "sent" || kirim.state === "error") {
      setKirim({ state: "idle", msg: "", receipt: "" });
    }
  };

  const terkirim = async (e) => {
    e.preventDefault();
    if (kosong) {
      setKirim({ state: "error", msg: "Tulis dulu teks jadwal atau RAB yang mau dikirim.", receipt: "" });
      return;
    }
    setKirim({ state: "sending", msg: "", receipt: "" });
    try {
      await api("/trigger", { method: "POST", body: JSON.stringify({ jenis: kode, data }) });
      setKirim({ state: "sent", msg: "", receipt: `${kode} · ${jamSekarang()} · ${user}` });
    } catch (err) {
      let msg = pesanApi(err);
      if (err && err.status === 502) {
        msg = "n8n tidak merespons (gagal). Workflow mungkin belum aktif, coba kirim lagi.";
      } else if (err && err.status === 503) {
        msg = "Webhook n8n belum dikonfigurasi di server. Hubungi admin server.";
      }
      setKirim({ state: "error", msg, receipt: "" });
    }
  };

  return (
    <>
      <main className="work">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <div className="head">
          <div>
            <span className="sec-label">Seksi 02 · Lembar 02/03</span>
            <h1>Kirim Trigger</h1>
          </div>
        </div>

        <form onSubmit={terkirim}>
          <div className="field" style={{ marginBottom: 10 }}>
            <span className="sec-label" id="label-jenis">
              Jenis pekerjaan
            </span>
            <div className="seg" role="group" aria-labelledby="label-jenis">
              <button type="button" aria-pressed={jenis === "jadwal"} onClick={() => pilihJenis("jadwal")}>
                Jadwal
              </button>
              <button type="button" aria-pressed={jenis === "rab"} onClick={() => pilihJenis("rab")}>
                RAB
              </button>
            </div>
            <p className="jenis-code">JENIS DIKIRIM: {kode}</p>
          </div>

          <div className="field">
            <label htmlFor="data-trigger">Teks {jenis === "jadwal" ? "jadwal harian" : "rencana anggaran"}</label>
            <textarea
              id="data-trigger"
              value={data}
              onChange={ubahTeks}
              maxLength={4000}
              placeholder={jenis === "jadwal" ? CONTOH_JADWAL : CONTOH_RAB}
              disabled={sedangKirim}
              spellCheck="false"
            />
            <p className="counter" aria-live="polite">
              {data.length} / 4000 KARAKTER
            </p>
          </div>

          <button type="submit" className="btn btn-prim" disabled={sedangKirim || kosong}>
            {sedangKirim ? "Mengirim…" : kirim.state === "sent" ? "Kirim Lagi" : "Kirim Trigger"}
          </button>
          <p className="jenis-code" style={{ marginTop: 10 }}>
            AKUN {user} DIKIRIM OTOMATIS BERSAMA TEKS INI.
          </p>
        </form>

        <div aria-live="polite">
          {kirim.state === "sending" && (
            <div className="msg" role="status">
              <span className="tag">Status</span>
              <span className="st pending">
                <span className="ln dash" aria-hidden="true" />
                Mengirim ke webhook n8n…
              </span>
            </div>
          )}
          {kirim.state === "error" && (
            <div className="msg msg-err" role="alert">
              <span className="tag">Gagal terkirim</span>
              {kirim.msg}
            </div>
          )}
          {kirim.state === "sent" && (
            <div className="msg msg-ok" role="status">
              <span className="tag">Hasil kirim</span>
              <span className="stamp">Terkirim</span>
              <p className="receipt">{kirim.receipt}</p>
            </div>
          )}
        </div>
      </main>

      <aside className="aside">
        <span className="k">Lembar sisipan · catatan kirim</span>
        <div className="sheetlet">
          <h2>Cara Pakai</h2>
          <p style={{ marginBottom: 12 }}>
            Pilih <b>Jadwal</b> atau <b>RAB</b>, tempel teksnya, lalu tekan <b>Kirim Trigger</b>. Teks dikirim apa
            adanya ke workflow n8n.
          </p>
          <p className="jenis-code">
            JADWAL → JENIS /JADWAL
            <br />
            RAB → JENIS /RAB
          </p>
        </div>
        <div className="sheetlet">
          <h2>Status Lanjutan</h2>
          <p className="jenis-code">
            PROSES DI DALAM N8N BELUM DITAMPILKAN. UNTUK SEKARANG STATUS AKHIR YANG JUJUR ADALAH &quot;TERKIRIM&quot; ATAU
            &quot;GAGAL&quot;.
          </p>
        </div>
      </aside>
    </>
  );
}
