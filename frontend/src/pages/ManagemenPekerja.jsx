import { useCallback, useEffect, useState } from "react";
import { api, pesanApi } from "../api";

const pad2 = (n) => String(n).padStart(2, "0");

// Sumber: string 'YYYY-MM-DD HH:MM:SS' dari database (waktu mesin Revo).
const fmtWaktu = (s) => {
  if (!s) return "-";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d
    .toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .toUpperCase();
};

export default function ManagemenPekerjaPage() {
  const [tab, setTab] = useState("pekerja");

  const [pekerja, setPekerja] = useState([]);
  const [stPekerja, setStPekerja] = useState("loading");
  const [errPekerja, setErrPekerja] = useState("");

  const [pinBaru, setPinBaru] = useState("");
  const [namaBaru, setNamaBaru] = useState("");
  const [peranBaru, setPeranBaru] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState(null);

  const [editUid, setEditUid] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [editPeran, setEditPeran] = useState("");
  const [savingUid, setSavingUid] = useState(null);
  const [pendingHapus, setPendingHapus] = useState(null);
  const [hapusUid, setHapusUid] = useState(null);
  const [rowError, setRowError] = useState("");

  const [riwayat, setRiwayat] = useState(null); // null = tab belum pernah dibuka
  const [stRiwayat, setStRiwayat] = useState("idle");
  const [errRiwayat, setErrRiwayat] = useState("");

  const muatPekerja = useCallback(async (opts = {}) => {
    if (!opts.silent) {
      setStPekerja("loading");
      setErrPekerja("");
    }
    try {
      setPekerja(await api("/revo/users"));
      setStPekerja("ready");
    } catch (err) {
      setErrPekerja(pesanApi(err));
      setStPekerja("error");
    }
  }, []);

  const muatRiwayat = useCallback(async () => {
    setStRiwayat("loading");
    setErrRiwayat("");
    try {
      setRiwayat(await api("/revo/riwayat?limit=500"));
      setStRiwayat("ready");
    } catch (err) {
      setErrRiwayat(pesanApi(err));
      setStRiwayat("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- muat({silent:true}) tidak men-set apa pun secara sinkron; status loading sudah jadi state awal
    muatPekerja({ silent: true });
  }, [muatPekerja]);

  useEffect(() => {
    if (tab === "riwayat" && stRiwayat === "idle") {
      // eslint-disable-next-line react/set-state-in-effect -- muatRiwayat hanya fetch lalu set hasil async; hasil fetch tidak bisa dihitung saat render
      muatRiwayat();
    }
  }, [tab, stRiwayat, muatRiwayat]);

  const muatUlang = () => {
    if (tab === "riwayat") muatRiwayat();
    else muatPekerja();
  };

  const sedangMemuat = tab === "riwayat" ? stRiwayat === "loading" : stPekerja === "loading";

  const tambah = async (e) => {
    e.preventDefault();
    const pin = pinBaru.trim();
    const nama = namaBaru.trim();
    if (!pin || !nama) {
      setCMsg({ ok: false, text: "PIN dan nama wajib diisi." });
      return;
    }
    setCBusy(true);
    setCMsg(null);
    try {
      await api("/revo/users", {
        method: "POST",
        body: JSON.stringify({ user_id: pin, name: nama, role: peranBaru.trim() }),
      });
      setPinBaru("");
      setNamaBaru("");
      setPeranBaru("");
      setCMsg({ ok: true, text: `${nama} ditambahkan.` });
      await muatPekerja({ silent: true });
    } catch (err) {
      if (err && err.status === 409) setCMsg({ ok: false, text: `PIN ${pin} sudah terdaftar.` });
      else setCMsg({ ok: false, text: pesanApi(err) });
    } finally {
      setCBusy(false);
    }
  };

  const simpan = async (uid) => {
    const nama = editNama.trim();
    if (!nama) return;
    setSavingUid(uid);
    setRowError("");
    try {
      await api(`/revo/users/${encodeURIComponent(uid)}`, {
        method: "PUT",
        body: JSON.stringify({ name: nama, role: editPeran.trim() }),
      });
      setEditUid(null);
      setEditNama("");
      setEditPeran("");
      await muatPekerja({ silent: true });
    } catch (err) {
      setRowError(pesanApi(err));
    } finally {
      setSavingUid(null);
    }
  };

  const hapus = async (item) => {
    setHapusUid(item.user_id);
    setRowError("");
    try {
      await api(`/revo/users/${encodeURIComponent(item.user_id)}`, { method: "DELETE" });
      setPendingHapus(null);
      await muatPekerja({ silent: true });
    } catch (err) {
      if (err && err.status === 404) {
        setRowError("Data sudah tidak ada. Daftar dimuat ulang.");
        setPendingHapus(null);
        await muatPekerja({ silent: true });
      } else {
        setRowError(pesanApi(err));
      }
    } finally {
      setHapusUid(null);
    }
  };

  const batalEdit = () => {
    setEditUid(null);
    setEditNama("");
    setEditPeran("");
  };

  const total = pekerja.length;
  const tanpaNama = pekerja.filter((p) => p.name === "Belum Diberi Nama").length;
  const riwayatSiap = stRiwayat === "ready" && Array.isArray(riwayat);
  const unikRiwayat = riwayatSiap ? new Set(riwayat.map((r) => r.user_id)).size : 0;

  return (
    <>
      <main className="work">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <div className="head">
          <div>
            <span className="sec-label">Seksi 05 · Lembar 05/05</span>
            <h1>Managemen Pekerja</h1>
          </div>
          <button type="button" className="btn" onClick={muatUlang} disabled={sedangMemuat}>
            {sedangMemuat ? "Memuat…" : "Muat ulang"}
          </button>
        </div>

        <div className="field" style={{ marginBottom: 22 }}>
          <span className="sec-label" id="label-tampilan">
            Tampilan
          </span>
          <div className="seg seg-tab" role="group" aria-labelledby="label-tampilan">
            <button
              type="button"
              aria-pressed={tab === "pekerja"}
              onClick={() => setTab("pekerja")}
            >
              Managemen Pekerja
            </button>
            <button
              type="button"
              aria-pressed={tab === "riwayat"}
              onClick={() => setTab("riwayat")}
            >
              Riwayat Kedatangan
            </button>
          </div>
        </div>

        <div className="stats" aria-label="Ringkasan data">
          {tab === "pekerja" ? (
            <>
              <div className="stat">
                <span className="k">Total pekerja</span>
                <span className="v">{stPekerja === "ready" ? pad2(total) : "—"}</span>
              </div>
              <div className="stat">
                <span className="k">Tanpa nama</span>
                <span className="v">{stPekerja === "ready" ? pad2(tanpaNama) : "—"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span className="k">Total catatan</span>
                <span className="v">{riwayatSiap ? pad2(riwayat.length) : "—"}</span>
              </div>
              <div className="stat">
                <span className="k">Pekerja terlibat</span>
                <span className="v">{riwayatSiap ? pad2(unikRiwayat) : "—"}</span>
              </div>
            </>
          )}
        </div>

        {tab === "pekerja" && (
          <>
            {stPekerja === "loading" && (
              <div className="load-rows" role="status" aria-live="polite">
                <span className="sec-label">Memuat daftar pekerja…</span>
                <div className="lr">
                  <span className="ln dash" aria-hidden="true" />
                  <span className="ln dash" style={{ width: 180 }} aria-hidden="true" />
                </div>
                <div className="lr">
                  <span className="ln dash" aria-hidden="true" />
                  <span className="ln dash" style={{ width: 140 }} aria-hidden="true" />
                </div>
              </div>
            )}

            {stPekerja === "error" && (
              <div className="msg msg-err" role="alert">
                <span className="tag">Galat memuat</span>
                {errPekerja}
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-sm" onClick={() => muatPekerja()}>
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            {stPekerja === "ready" && pekerja.length === 0 && (
              <div className="empty">
                <span className="t">Belum ada pekerja terdaftar</span>
                <p>
                  Tambah lewat formulir di sisipan (atau bawah di layar sempit). Scan dari mesin
                  juga membuat entri otomatis dengan nama default.
                </p>
              </div>
            )}

            {stPekerja === "ready" && pekerja.length > 0 && (
              <div className="tabel kolom-pekerja">
                <div className="thead" role="row" aria-hidden="true">
                  <span>No</span>
                  <span>PIN</span>
                  <span>Nama</span>
                  <span>Peran</span>
                  <span style={{ textAlign: "right" }}>Aksi</span>
                </div>
                {rowError && (
                  <div className="msg msg-err" role="alert">
                    <span className="tag">Galat baris</span>
                    {rowError}
                  </div>
                )}
                {pekerja.map((it, i) => {
                  const editing = editUid === it.user_id;
                  const saving = savingUid === it.user_id;
                  const deleting = hapusUid === it.user_id;
                  const pending = pendingHapus === it.user_id;
                  const onKeyDownSimpan = (e) => {
                    if (e.key === "Enter") simpan(it.user_id);
                    if (e.key === "Escape") batalEdit();
                  };
                  return (
                    <div className="trow" key={it.id} role="row">
                      <span className="no" data-label="No">
                        {pad2(i + 1)}
                      </span>
                      <span className="p" data-label="PIN">
                        {it.user_id}
                      </span>
                      <span className="u" data-label="Nama">
                        {editing ? (
                          <input
                            value={editNama}
                            onChange={(e) => setEditNama(e.target.value)}
                            onKeyDown={onKeyDownSimpan}
                            disabled={saving}
                            maxLength={100}
                            aria-label="Nama pekerja"
                            autoFocus
                          />
                        ) : (
                          it.name
                        )}
                      </span>
                      <span data-label="Peran">
                        {editing ? (
                          <input
                            value={editPeran}
                            onChange={(e) => setEditPeran(e.target.value)}
                            onKeyDown={onKeyDownSimpan}
                            disabled={saving}
                            maxLength={50}
                            aria-label="Peran pekerja"
                            placeholder="Tanpa peran"
                          />
                        ) : (
                          it.role || "Tanpa peran"
                        )}
                      </span>
                      <span className="ak" data-label="Aksi">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-prim"
                              onClick={() => simpan(it.user_id)}
                              disabled={saving || !editNama.trim()}
                            >
                              {saving ? "Menyimpan…" : "Simpan"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={batalEdit}
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
                              onClick={() => setPendingHapus(null)}
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
                                setEditUid(it.user_id);
                                setEditNama(it.name);
                                setEditPeran(it.role);
                              }}
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => setPendingHapus(it.user_id)}
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
          </>
        )}

        {tab === "riwayat" && (
          <>
            {(stRiwayat === "idle" || stRiwayat === "loading") && (
              <div className="load-rows" role="status" aria-live="polite">
                <span className="sec-label">Memuat riwayat kedatangan…</span>
                <div className="lr">
                  <span className="ln dash" aria-hidden="true" />
                  <span className="ln dash" style={{ width: 200 }} aria-hidden="true" />
                </div>
                <div className="lr">
                  <span className="ln dash" aria-hidden="true" />
                  <span className="ln dash" style={{ width: 150 }} aria-hidden="true" />
                </div>
              </div>
            )}

            {stRiwayat === "error" && (
              <div className="msg msg-err" role="alert">
                <span className="tag">Galat memuat</span>
                {errRiwayat}
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-sm" onClick={muatRiwayat}>
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            {stRiwayat === "ready" && riwayat.length === 0 && (
              <div className="empty">
                <span className="t">Belum ada catatan kehadiran</span>
                <p>
                  Setiap scan pekerja di mesin Revo akan muncul di sini beserta nama dan perannya.
                </p>
              </div>
            )}

            {stRiwayat === "ready" && riwayat.length > 0 && (
              <div className="tabel kolom-riwayat">
                <div className="thead" role="row" aria-hidden="true">
                  <span>No</span>
                  <span>PIN</span>
                  <span>Nama</span>
                  <span>Peran</span>
                  <span style={{ textAlign: "right" }}>Waktu</span>
                </div>
                {riwayat.map((r, i) => (
                  <div
                    className="trow"
                    key={`${r.user_id}|${r.timestamp}`}
                    role="row"
                  >
                    <span className="no" data-label="No">
                      {pad2(i + 1)}
                    </span>
                    <span className="p" data-label="PIN">
                      {r.user_id}
                    </span>
                    <span className="u" data-label="Nama">
                      {r.nama || "Tanpa nama"}
                    </span>
                    <span data-label="Peran">{r.role || "Tanpa peran"}</span>
                    <span className="waktu" data-label="Waktu">
                      {fmtWaktu(r.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {tab === "pekerja" ? (
        <aside className="aside">
          <span className="k">Lembar sisipan · formulir</span>

          <form className="sheetlet" onSubmit={tambah}>
            <h2>Tambah Pekerja</h2>
            <div className="field">
              <label htmlFor="pin-baru">PIN di mesin</label>
              <input
                id="pin-baru"
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value)}
                disabled={cBusy}
                maxLength={50}
                autoComplete="off"
                inputMode="numeric"
              />
              <p className="jenis-code">ANGKA ATAU HURUF, TANPA SPASI</p>
            </div>
            <div className="field">
              <label htmlFor="nama-baru">Nama lengkap</label>
              <input
                id="nama-baru"
                value={namaBaru}
                onChange={(e) => setNamaBaru(e.target.value)}
                disabled={cBusy}
                maxLength={100}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="peran-baru">Peran</label>
              <input
                id="peran-baru"
                value={peranBaru}
                onChange={(e) => setPeranBaru(e.target.value)}
                disabled={cBusy}
                maxLength={50}
                placeholder="Staff / Karyawan"
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
              PIN yang belum terdaftar tetap diterima saat scan: nama pekerja otomatis terisi{" "}
              <b>Belum Diberi Nama</b>, lalu tinggal diganti lewat tombol Ubah.
            </p>
            <p style={{ marginBottom: 12 }}>
              <b>Menghapus pekerja ikut menghapus seluruh riwayat absensinya</b>, jadi hapus hanya
              untuk yang sudah tidak bekerja.
            </p>
            <p className="jenis-code">
              HAPUS → KONFIRMASI DI BARIS
              <br />
              UBAH → EDIT LANGSUNG DI TABEL
              <br />
              SCAN BARU → NAMA DEFAULT BELUM DIBERI NAMA
            </p>
          </div>
        </aside>
      ) : (
        <aside className="aside">
          <span className="k">Lembar sisipan · catatan</span>

          <div className="sheetlet">
            <h2>Tentang Riwayat</h2>
            <p style={{ marginBottom: 12 }}>
              Setiap baris adalah satu scan dari mesin Revo. <b>Nama</b> dan <b>peran</b> diambil
              dari daftar pekerja lewat PIN yang sama.
            </p>
            <p style={{ marginBottom: 12 }}>
              Urutan terbaru di atas, maksimal 500 catatan terakhir. Tekan <b>Muat ulang</b> untuk
              menyegarkan.
            </p>
            <p className="jenis-code">
              SUMBER → REVO_ATTEND × REVO_USERS
              <br />
              URUT → TERBARU DULU
              <br />
              BATAS → 500 CATATAN
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
