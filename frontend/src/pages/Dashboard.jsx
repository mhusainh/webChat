import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, pesanApi } from "../api";
import { useAuth } from "../auth";

const fmtTanggal = (iso) =>
  new Date(iso)
    .toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

const hariIni = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const pad2 = (n) => String(n).padStart(2, "0");

export default function Dashboard() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [rowError, setRowError] = useState("");

  const [akunBaru, setAkunBaru] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState(null);

  const [sandiLama, setSandiLama] = useState("");
  const [sandi1, setSandi1] = useState("");
  const [sandi2, setSandi2] = useState("");
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState(null);

  const muat = useCallback(async (opts = {}) => {
    if (!opts.silent) {
      setStatus("loading");
      setLoadError("");
    }
    try {
      setUsers(await api("/users"));
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

  const hapus = async (u) => {
    setDeletingId(u.id);
    setRowError("");
    try {
      await api(`/users/${u.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await muat();
    } catch (err) {
      if (err && err.status === 404) {
        setRowError("Akun sudah tidak ada. Daftar dimuat ulang.");
        await muat();
      } else {
        setRowError(pesanApi(err));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const buatAkun = async (e) => {
    e.preventDefault();
    const nama = akunBaru.trim();
    if (nama.length < 3 || sandiBaru.length < 3) {
      setCMsg({ ok: false, text: "Nama pengguna dan kata sandi minimal 3 karakter." });
      return;
    }
    setCBusy(true);
    setCMsg(null);
    try {
      await api("/users", { method: "POST", body: JSON.stringify({ username: nama, password: sandiBaru }) });
      setAkunBaru("");
      setSandiBaru("");
      setCMsg({ ok: true, text: `Akun ${nama} dibuat.` });
      await muat();
    } catch (err) {
      setCMsg({ ok: false, text: pesanApi(err) });
    } finally {
      setCBusy(false);
    }
  };

  const gantiSandi = async (e) => {
    e.preventDefault();
    if (sandi1.length < 3) {
      setPMsg({ ok: false, text: "Kata sandi baru minimal 3 karakter." });
      return;
    }
    if (sandi1 !== sandi2) {
      setPMsg({ ok: false, text: "Kata sandi baru tidak sama dengan konfirmasi." });
      return;
    }
    setPBusy(true);
    setPMsg(null);
    try {
      await api("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ old_password: sandiLama, new_password: sandi1 }),
      });
      setSandiLama("");
      setSandi1("");
      setSandi2("");
      setPMsg({ ok: true, text: "Kata sandi diperbarui." });
    } catch (err) {
      if (err && err.status === 400) {
        setPMsg({ ok: false, text: "Kata sandi lama salah." });
      } else {
        setPMsg({ ok: false, text: pesanApi(err) });
      }
    } finally {
      setPBusy(false);
    }
  };

  const total = users.length;
  const baruHariIni = users.filter((u) => u.created_at && hariIni(u.created_at)).length;

  return (
    <>
      <main className="work">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <div className="head">
          <div>
            <span className="sec-label">Seksi 01 · Lembar 01/03</span>
            <h1>Manajemen Akun</h1>
          </div>
          <Link className="btn btn-prim" to="/trigger">
            Kirim Trigger
          </Link>
        </div>

        <div className="stats" aria-label="Ringkasan akun">
          <div className="stat">
            <span className="k">Akun total</span>
            <span className="v">{status === "ready" ? pad2(total) : "—"}</span>
          </div>
          <div className="stat">
            <span className="k">Dibuat hari ini</span>
            <span className="v">{status === "ready" ? pad2(baruHariIni) : "—"}</span>
          </div>
          <div className="stat">
            <span className="k">Akun anda</span>
            <span className="v">{user}</span>
          </div>
        </div>

        {status === "loading" && (
          <div className="load-rows" role="status" aria-live="polite">
            <span className="sec-label">Memuat daftar akun…</span>
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

        {status === "ready" && users.length === 0 && (
          <div className="empty">
            <span className="t">Belum ada akun terdaftar</span>
            <p>Buat akun pertama lewat formulir tambah akun di sisipan kanan (atau bawah di layar sempit).</p>
          </div>
        )}

        {status === "ready" && users.length > 0 && (
          <div className="tabel">
            <div className="thead" role="row" aria-hidden="true">
              <span>No</span>
              <span>Pengguna</span>
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
            {users.map((u, i) => {
              const iniSaya = u.username === user;
              const deleting = deletingId === u.id;
              const pending = pendingDelete === u.id;
              return (
                <div className="trow" key={u.id} role="row">
                  <span className="no" data-label="No">
                    {pad2(i + 1)}
                  </span>
                  <span className="u" data-label="Pengguna">
                    {u.username}
                    {iniSaya && <span className="you">(ANDA)</span>}
                  </span>
                  <span className="p" data-label="Dibuat">
                    {u.created_at ? fmtTanggal(u.created_at) : "-"}
                  </span>
                  <span data-label="Status">
                    {deleting ? (
                      <span className="st pending">
                        <span className="ln dash" aria-hidden="true" />
                        Menghapus
                      </span>
                    ) : (
                      <span className="st">
                        <span className="ln" aria-hidden="true" />
                        Terdaftar
                      </span>
                    )}
                  </span>
                  <span className="ak" data-label="Aksi">
                    {iniSaya ? (
                      <span className="p" title="Tidak bisa menghapus akun sendiri">
                        AKUN ANDA
                      </span>
                    ) : pending ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => hapus(u)}
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
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setPendingDelete(u.id)}
                      >
                        Hapus
                      </button>
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

        <form className="sheetlet" onSubmit={buatAkun}>
          <h2>Tambah Akun</h2>
          <div className="field">
            <label htmlFor="akun-baru">Nama pengguna</label>
            <input
              id="akun-baru"
              value={akunBaru}
              onChange={(e) => setAkunBaru(e.target.value)}
              disabled={cBusy}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="sandi-baru">Kata sandi</label>
            <input
              id="sandi-baru"
              type="password"
              value={sandiBaru}
              onChange={(e) => setSandiBaru(e.target.value)}
              disabled={cBusy}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn-prim" disabled={cBusy}>
            {cBusy ? "Membuat…" : "Buat Akun"}
          </button>
          {cMsg && (
            <div className={"msg " + (cMsg.ok ? "msg-ok" : "msg-err")} role="status">
              <span className="tag">{cMsg.ok ? "Berhasil" : "Galat"}</span>
              {cMsg.text}
            </div>
          )}
        </form>

        <form className="sheetlet" onSubmit={gantiSandi}>
          <h2>Ganti Kata Sandi</h2>
          <div className="field">
            <label htmlFor="sandi-lama">Kata sandi lama</label>
            <input
              id="sandi-lama"
              type="password"
              value={sandiLama}
              onChange={(e) => setSandiLama(e.target.value)}
              disabled={pBusy}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label htmlFor="sandi-1">Kata sandi baru</label>
            <input
              id="sandi-1"
              type="password"
              value={sandi1}
              onChange={(e) => setSandi1(e.target.value)}
              disabled={pBusy}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="sandi-2">Ulangi sandi baru</label>
            <input
              id="sandi-2"
              type="password"
              value={sandi2}
              onChange={(e) => setSandi2(e.target.value)}
              disabled={pBusy}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn" disabled={pBusy}>
            {pBusy ? "Menyimpan…" : "Simpan Sandi"}
          </button>
          {pMsg && (
            <div className={"msg " + (pMsg.ok ? "msg-ok" : "msg-err")} role="status">
              <span className="tag">{pMsg.ok ? "Berhasil" : "Galat"}</span>
              {pMsg.text}
            </div>
          )}
        </form>
      </aside>
    </>
  );
}
