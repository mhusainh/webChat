import { useCallback, useEffect, useState } from "react";
import { api, pesanApi } from "../api";

const fmtTanggal = (iso) =>
  new Date(iso)
    .toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

const hariIni = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const pad2 = (n) => String(n).padStart(2, "0");

export default function KaryawanKhususPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rowError, setRowError] = useState("");

  const [editId, setEditId] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [namaBaru, setNamaBaru] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState(null);

  const muat = useCallback(async (opts = {}) => {
    if (!opts.silent) {
      setStatus("loading");
      setLoadError("");
    }
    try {
      setItems(await api("/karyawan-khusus"));
      setStatus("ready");
    } catch (err) {
      setLoadError(pesanApi(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- muat silent tidak men-set apa pun secara sinkron; analisis statis tidak bisa melacak opts.silent
    muat({ silent: true });
  }, [muat]);

  const hapus = async (item) => {
    setDeletingId(item.id);
    setRowError("");
    try {
      await api(`/karyawan-khusus/${item.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await muat();
    } catch (err) {
      if (err && err.status === 404) {
        setRowError("Data sudah tidak ada. Daftar dimuat ulang.");
        await muat();
      } else {
        setRowError(pesanApi(err));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const simpan = async (id) => {
    const nama = editNama.trim();
    if (!nama) return;
    setSavingId(id);
    setRowError("");
    try {
      await api(`/karyawan-khusus/${id}`, { method: "PUT", body: JSON.stringify({ nama }) });
      setEditId(null);
      setEditNama("");
      await muat();
    } catch (err) {
      setRowError(pesanApi(err));
    } finally {
      setSavingId(null);
    }
  };

  const tambah = async (e) => {
    e.preventDefault();
    const nama = namaBaru.trim();
    if (!nama) {
      setCMsg({ ok: false, text: "Nama tidak boleh kosong." });
      return;
    }
    setCBusy(true);
    setCMsg(null);
    try {
      await api("/karyawan-khusus", { method: "POST", body: JSON.stringify({ nama }) });
      setNamaBaru("");
      setCMsg({ ok: true, text: `${nama} ditambahkan.` });
      await muat();
    } catch (err) {
      setCMsg({ ok: false, text: pesanApi(err) });
    } finally {
      setCBusy(false);
    }
  };

  const total = items.length;
  const baruHariIni = items.filter((it) => it.created_at && hariIni(it.created_at)).length;

  return (
    <>
      <main className="work">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <div className="head">
          <div>
            <span className="sec-label">Seksi 03 · Lembar 03/03</span>
            <h1>Karyawan Khusus</h1>
          </div>
        </div>

        <div className="stats" aria-label="Ringkasan data">
          <div className="stat">
            <span className="k">Total data</span>
            <span className="v">{status === "ready" ? pad2(total) : "—"}</span>
          </div>
          <div className="stat">
            <span className="k">Dibuat hari ini</span>
            <span className="v">{status === "ready" ? pad2(baruHariIni) : "—"}</span>
          </div>
        </div>

        {status === "loading" && (
          <div className="load-rows" role="status" aria-live="polite">
            <span className="sec-label">Memuat daftar karyawan…</span>
            <div className="lr">
              <span className="ln dash" aria-hidden="true" />
              <span className="ln dash" style={{ width: 180 }} aria-hidden="true" />
            </div>
            <div className="lr">
              <span className="ln dash" aria-hidden="true" />
              <span className="ln dash" style={{ width: 140 }} aria-hidden="true" />
            </div>
            <div className="lr">
              <span className="ln dash" aria-hidden="true" />
              <span className="ln dash" style={{ width: 210 }} aria-hidden="true" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="msg msg-err" role="alert">
            <span className="tag">Galat memuat</span>
            {loadError}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={muat}>
                Coba lagi
              </button>
            </div>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="empty">
            <span className="t">Belum ada karyawan khusus</span>
            <p>Tambah nama lewat formulir di sisipan kanan (atau bawah di layar sempit).</p>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <div className="tabel">
            <div className="thead" role="row" aria-hidden="true">
              <span>No</span>
              <span>Nama</span>
              <span>Dibuat</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Aksi</span>
            </div>
            {rowError && (
              <div className="msg msg-err" role="alert">
                <span className="tag">Galat baris</span>
                {rowError}
              </div>
            )}
            {items.map((it, i) => {
              const editing = editId === it.id;
              const saving = savingId === it.id;
              const deleting = deletingId === it.id;
              const pending = pendingDelete === it.id;
              return (
                <div className="trow" key={it.id} role="row">
                  <span className="no" data-label="No">
                    {pad2(i + 1)}
                  </span>
                  <span className="u" data-label="Nama">
                    {editing ? (
                      <input
                        value={editNama}
                        onChange={(e) => setEditNama(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") simpan(it.id);
                          if (e.key === "Escape") {
                            setEditId(null);
                            setEditNama("");
                          }
                        }}
                        disabled={saving}
                        aria-label="Nama karyawan"
                        autoFocus
                      />
                    ) : (
                      it.nama
                    )}
                  </span>
                  <span className="p" data-label="Dibuat">
                    {it.created_at ? fmtTanggal(it.created_at) : "-"}
                  </span>
                  <span data-label="Status">
                    {deleting ? (
                      <span className="st pending">
                        <span className="ln dash" aria-hidden="true" />
                        Menghapus
                      </span>
                    ) : saving ? (
                      <span className="st pending">
                        <span className="ln dash" aria-hidden="true" />
                        Menyimpan
                      </span>
                    ) : (
                      <span className="st">
                        <span className="ln" aria-hidden="true" />
                        Terdaftar
                      </span>
                    )}
                  </span>
                  <span className="ak" data-label="Aksi">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-prim"
                          onClick={() => simpan(it.id)}
                          disabled={saving || !editNama.trim()}
                        >
                          {saving ? "Menyimpan…" : "Simpan"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setEditId(null);
                            setEditNama("");
                          }}
                          disabled={saving}
                        >
                          Batal
                        </button>
                      </>
                    ) : pending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => hapus(it)}
                          disabled={deleting}
                        >
                          {deleting ? "Menghapus…" : "Ya, hapus"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setPendingDelete(null)}
                          disabled={deleting}
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setEditId(it.id);
                            setEditNama(it.nama);
                          }}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setPendingDelete(it.id)}
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <aside className="aside">
        <span className="k">Lembar sisipan · formulir</span>

        <form className="sheetlet" onSubmit={tambah}>
          <h2>Tambah Karyawan</h2>
          <div className="field">
            <label htmlFor="nama-baru">Nama lengkap</label>
            <input
              id="nama-baru"
              value={namaBaru}
              onChange={(e) => setNamaBaru(e.target.value)}
              disabled={cBusy}
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-prim" disabled={cBusy}>
            {cBusy ? "Menambahkan…" : "Tambah"}
          </button>
          {cMsg && (
            <div className={"msg " + (cMsg.ok ? "msg-ok" : "msg-err")} role="status">
              <span className="tag">{cMsg.ok ? "Berhasil" : "Galat"}</span>
              {cMsg.text}
            </div>
          )}
        </form>

        <div className="sheetlet">
          <h2>Cara Pakai</h2>
          <p style={{ marginBottom: 12 }}>
            Tambah nama lewat formulir di atas. Untuk mengubah, tekan <b>Ubah</b> di baris tabel lalu edit namanya
            langsung.
          </p>
          <p style={{ marginBottom: 12 }}>
            <b>Nama harus sama persis dengan yang tersimpan di Excel</b> — huruf besar/kecil, spasi, dan ejaan wajib
            cocok, supaya data karyawan ini terbaca oleh workflow gaji.
          </p>
          <p className="jenis-code">
            HAPUS → KONFIRMASI DI BARIS
            <br />
            UBAH → EDIT LANGSUNG DI TABEL
            <br />
            NAMA → HARUS PERSIS DENGAN DI EXCEL
          </p>
        </div>
      </aside>
    </>
  );
}