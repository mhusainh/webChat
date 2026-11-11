import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Nilai <select> untuk saringan "Tanpa peran" (peran asli bisa berupa teks apa pun).
const PERAN_KOSONG = "__tanpa__";

// Peran hanya dua pilihan. Nilai lama di luar daftar tetap ditampilkan saat edit
// (opsi kondisional) supaya tidak ada perubahan peran diam-diam.
const PERAN_OPSI = ["Karyawan", "Staff"];

export default function ManagemenPekerjaPage() {
  const [tab, setTab] = useState("pekerja");

  /* --- daftar pekerja --- */
  const [pekerja, setPekerja] = useState([]);
  const [stPekerja, setStPekerja] = useState("loading");
  const [errPekerja, setErrPekerja] = useState("");
  const [cariP, setCariP] = useState("");
  const [peranP, setPeranP] = useState("");
  const [sortP, setSortP] = useState("asc");

  const [uidBaru, setUidBaru] = useState("");
  const [namaBaru, setNamaBaru] = useState("");
  const [peranBaru, setPeranBaru] = useState("Karyawan");
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState(null);

  const [editUid, setEditUid] = useState(null);
  const [editUidBaru, setEditUidBaru] = useState(""); // isi input User ID saat mode ubah
  const [editNama, setEditNama] = useState("");
  const [editPeran, setEditPeran] = useState("");
  const [savingUid, setSavingUid] = useState(null);
  const [pendingHapus, setPendingHapus] = useState(null);
  const [hapusUid, setHapusUid] = useState(null);
  const [rowError, setRowError] = useState("");

  /* --- riwayat kedatangan --- */
  const [riwayat, setRiwayat] = useState(null); // null = tab belum pernah dibuka
  const [stRiwayat, setStRiwayat] = useState("idle");
  const [errRiwayat, setErrRiwayat] = useState("");
  const [cariInput, setCariInput] = useState("");
  const [cariRw, setCariRw] = useState(""); // versi debounce dari cariInput
  const [peranRw, setPeranRw] = useState("");
  const [tglAwal, setTglAwal] = useState("");
  const [tglAkhir, setTglAkhir] = useState("");
  const [sortRw, setSortRw] = useState("time_desc");
  const [errFilter, setErrFilter] = useState("");
  const [errRw, setErrRw] = useState("");
  const [pendingHapusRw, setPendingHapusRw] = useState(null);
  const [hapusRwId, setHapusRwId] = useState(null);

  const rwSeq = useRef(0); // balasan basi (race) dibuang lewat nomor urut

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

  const muatRiwayat = useCallback(
    async (opts = {}) => {
      if (tglAwal && tglAkhir && tglAwal > tglAkhir) {
        setErrFilter("Tanggal awal melebihi tanggal akhir.");
        return;
      }
      setErrFilter("");
      const seq = ++rwSeq.current;
      if (!opts.silent) {
        setStRiwayat("loading");
        setErrRiwayat("");
      }
      const q = new URLSearchParams({ limit: "500" });
      if (cariRw) q.set("search", cariRw);
      if (peranRw) q.set("role", peranRw === PERAN_KOSONG ? "" : peranRw);
      if (tglAwal) q.set("date_from", tglAwal);
      if (tglAkhir) q.set("date_to", tglAkhir);
      if (sortRw !== "time_desc") q.set("sort", sortRw);
      try {
        const data = await api(`/revo/riwayat?${q.toString()}`);
        if (seq !== rwSeq.current) return;
        setRiwayat(data);
        setStRiwayat("ready");
      } catch (err) {
        if (seq !== rwSeq.current) return;
        setErrRiwayat(pesanApi(err));
        setStRiwayat("error");
      }
    },
    [cariRw, peranRw, tglAwal, tglAkhir, sortRw],
  );

  // Satu pemicu untuk dua hal:
  // - klik tab (atau ganti filter riwayat) = muat ulang data tab itu dari server,
  //   jadi edit di Managemen Pekerja langsung terbaca saat Riwayat Kedatangan dibuka;
  // - perubahan filter/sort riwayat = ambil ulang dengan saringan baru.
  useEffect(() => {
    setEditUid(null);
    setEditNama("");
    setEditPeran("");
    setPendingHapus(null);
    setPendingHapusRw(null);
    setRowError("");
    setErrRw("");
    if (tab === "riwayat") muatRiwayat();
    else muatPekerja();
    // muatPekerja/muatRiwayat sengaja tidak ikut deps: identitas mereka berganti
    // tiap filter riwayat berubah — justru perubahan itulah pemicu efek ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cariRw, peranRw, tglAwal, tglAkhir, sortRw]);

  useEffect(() => {
    const t = setTimeout(() => setCariRw(cariInput.trim()), 300);
    return () => clearTimeout(t);
  }, [cariInput]);

  const muatUlang = () => {
    if (tab === "riwayat") muatRiwayat();
    else muatPekerja();
  };

  const sedangMemuat = tab === "riwayat" ? stRiwayat === "loading" : stPekerja === "loading";

  const resetFilterP = () => {
    setCariP("");
    setPeranP("");
  };

  const resetFilterRw = () => {
    setCariInput("");
    setCariRw("");
    setPeranRw("");
    setTglAwal("");
    setTglAkhir("");
  };

  const tambah = async (e) => {
    e.preventDefault();
    const uid = uidBaru.trim();
    const nama = namaBaru.trim();
    if (!uid || !nama) {
      setCMsg({ ok: false, text: "User ID dan nama wajib diisi." });
      return;
    }
    setCBusy(true);
    setCMsg(null);
    try {
      await api("/revo/users", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, name: nama, role: peranBaru.trim() }),
      });
      setUidBaru("");
      setNamaBaru("");
      setPeranBaru("Karyawan");
      setCMsg({ ok: true, text: `${nama} ditambahkan.` });
      await muatPekerja({ silent: true });
    } catch (err) {
      if (err && err.status === 409) setCMsg({ ok: false, text: `User ID ${uid} sudah terdaftar.` });
      else setCMsg({ ok: false, text: pesanApi(err) });
    } finally {
      setCBusy(false);
    }
  };

  const simpan = async (uid) => {
    const nama = editNama.trim();
    const uidBaruEdit = editUidBaru.trim();
    if (!nama) return;
    if (!uidBaruEdit) {
      setRowError("User ID wajib diisi.");
      return;
    }
    if (!/^[0-9A-Za-z_-]+$/.test(uidBaruEdit)) {
      setRowError("User ID hanya boleh huruf, angka, strip, atau garis bawah.");
      return;
    }
    setSavingUid(uid);
    setRowError("");
    try {
      await api(`/revo/users/${encodeURIComponent(uid)}`, {
        method: "PUT",
        body: JSON.stringify({ name: nama, role: editPeran.trim(), user_id: uidBaruEdit }),
      });
      setEditUid(null);
      setEditUidBaru("");
      setEditNama("");
      setEditPeran("");
      await muatPekerja({ silent: true });
    } catch (err) {
      if (err && err.status === 409) setRowError(`User ID ${uidBaruEdit} sudah dipakai pekerja lain.`);
      else setRowError(pesanApi(err));
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

  const hapusBaris = async (baris) => {
    setHapusRwId(baris.id);
    setErrRw("");
    try {
      await api(`/revo/riwayat/${baris.id}`, { method: "DELETE" });
      setPendingHapusRw(null);
      await muatRiwayat({ silent: true });
    } catch (err) {
      if (err && err.status === 404) {
        setErrRw("Catatan sudah tidak ada. Daftar dimuat ulang.");
        setPendingHapusRw(null);
        await muatRiwayat({ silent: true });
      } else {
        setErrRw(pesanApi(err));
      }
    } finally {
      setHapusRwId(null);
    }
  };

  const batalEdit = () => {
    setEditUid(null);
    setEditUidBaru("");
    setEditNama("");
    setEditPeran("");
  };

  const tampil = useMemo(() => {
    const q = cariP.trim().toLowerCase();
    let list = pekerja;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (peranP === PERAN_KOSONG) list = list.filter((p) => !p.role);
    else if (peranP) list = list.filter((p) => p.role === peranP);
    const arah = sortP === "desc" ? -1 : 1;
    return [...list].sort((a, b) => (a.name.localeCompare(b.name) || a.id - b.id) * arah);
  }, [pekerja, cariP, peranP, sortP]);

  const total = pekerja.length;
  const tanpaNama = pekerja.filter((p) => p.name === "Belum Diberi Nama").length;
  const adaTanpaPeran = pekerja.some((p) => !p.role);
  const filterP = Boolean(cariP.trim() || peranP);
  const filterRw = Boolean(cariRw || peranRw || tglAwal || tglAkhir);
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
                <span className="v">{stPekerja === "ready" ? pad2(total) : "-"}</span>
              </div>
              <div className="stat">
                <span className="k">Ditampilkan</span>
                <span className="v">{stPekerja === "ready" ? pad2(tampil.length) : "-"}</span>
              </div>
              <div className="stat">
                <span className="k">Tanpa nama</span>
                <span className="v">{stPekerja === "ready" ? pad2(tanpaNama) : "-"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span className="k">Total catatan</span>
                <span className="v">{riwayatSiap ? pad2(riwayat.length) : "-"}</span>
              </div>
              <div className="stat">
                <span className="k">Pekerja terlibat</span>
                <span className="v">{riwayatSiap ? pad2(unikRiwayat) : "-"}</span>
              </div>
            </>
          )}
        </div>

        {tab === "pekerja" && (
          <>
            <div className="filter-bar">
              <div className="field f-cari">
                <label htmlFor="cari-pekerja">Cari nama</label>
                <input
                  id="cari-pekerja"
                  type="search"
                  value={cariP}
                  onChange={(e) => setCariP(e.target.value)}
                  placeholder="Ketik nama…"
                  maxLength={100}
                  autoComplete="off"
                />
              </div>
              <div className="field f-pilih">
                <label htmlFor="peran-pekerja">Peran</label>
                <select
                  id="peran-pekerja"
                  value={peranP}
                  onChange={(e) => setPeranP(e.target.value)}
                >
                  <option value="">Semua peran</option>
                  {(adaTanpaPeran || peranP === PERAN_KOSONG) && (
                    <option value={PERAN_KOSONG}>Tanpa peran</option>
                  )}
                  {PERAN_OPSI.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field f-pilih">
                <label htmlFor="urut-pekerja">Urutkan</label>
                <select id="urut-pekerja" value={sortP} onChange={(e) => setSortP(e.target.value)}>
                  <option value="asc">Nama A→Z</option>
                  <option value="desc">Nama Z→A</option>
                </select>
              </div>
              {filterP && (
                <button type="button" className="btn btn-sm" onClick={resetFilterP}>
                  Hapus filter
                </button>
              )}
            </div>

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

            {stPekerja === "ready" && pekerja.length > 0 && tampil.length === 0 && (
              <div className="empty">
                <span className="t">Tidak ada pekerja yang cocok</span>
                <p>Cari nama atau saringan peran tidak menemukan hasil.</p>
                <button type="button" className="btn btn-sm" onClick={resetFilterP}>
                  Hapus filter
                </button>
              </div>
            )}

            {stPekerja === "ready" && tampil.length > 0 && (
              <div className="tabel kolom-pekerja">
                <div className="thead" role="row" aria-hidden="true">
                  <span>No</span>
                  <span>User ID</span>
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
                {tampil.map((it, i) => {
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
                      <span className="p" data-label="User ID">
                        {editing ? (
                          <input
                            value={editUidBaru}
                            onChange={(e) => setEditUidBaru(e.target.value)}
                            onKeyDown={onKeyDownSimpan}
                            disabled={saving}
                            maxLength={50}
                            autoComplete="off"
                            aria-label="User ID pekerja"
                          />
                        ) : (
                          it.user_id
                        )}
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
                          <select
                            value={editPeran}
                            onChange={(e) => setEditPeran(e.target.value)}
                            onKeyDown={onKeyDownSimpan}
                            disabled={saving}
                            aria-label="Peran pekerja"
                          >
                            {!PERAN_OPSI.includes(editPeran) && (
                              <option value={editPeran}>{editPeran || "Tanpa peran"}</option>
                            )}
                            {PERAN_OPSI.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
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
                                setEditUidBaru(it.user_id);
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
            <div className="filter-bar">
              <div className="field f-cari">
                <label htmlFor="cari-riwayat">Cari nama</label>
                <input
                  id="cari-riwayat"
                  type="search"
                  value={cariInput}
                  onChange={(e) => setCariInput(e.target.value)}
                  placeholder="Ketik nama…"
                  maxLength={100}
                  autoComplete="off"
                />
              </div>
              <div className="field f-pilih">
                <label htmlFor="peran-riwayat">Peran</label>
                <select
                  id="peran-riwayat"
                  value={peranRw}
                  onChange={(e) => setPeranRw(e.target.value)}
                >
                  <option value="">Semua peran</option>
                  {(adaTanpaPeran || peranRw === PERAN_KOSONG) && (
                    <option value={PERAN_KOSONG}>Tanpa peran</option>
                  )}
                  {PERAN_OPSI.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field f-tgl">
                <label htmlFor="tgl-awal">Tanggal awal</label>
                <input
                  id="tgl-awal"
                  type="date"
                  value={tglAwal}
                  onChange={(e) => setTglAwal(e.target.value)}
                />
              </div>
              <div className="field f-tgl">
                <label htmlFor="tgl-akhir">Tanggal akhir</label>
                <input
                  id="tgl-akhir"
                  type="date"
                  value={tglAkhir}
                  onChange={(e) => setTglAkhir(e.target.value)}
                />
              </div>
              <div className="field f-pilih">
                <label htmlFor="urut-riwayat">Urutkan</label>
                <select
                  id="urut-riwayat"
                  value={sortRw}
                  onChange={(e) => setSortRw(e.target.value)}
                >
                  <option value="time_desc">Tanggal terbaru</option>
                  <option value="time_asc">Tanggal terlama</option>
                  <option value="name_asc">Nama A→Z</option>
                  <option value="name_desc">Nama Z→A</option>
                </select>
              </div>
              {filterRw && (
                <button type="button" className="btn btn-sm" onClick={resetFilterRw}>
                  Hapus filter
                </button>
              )}
            </div>

            {errFilter && (
              <div className="msg msg-err" role="alert">
                <span className="tag">Rentang tanggal</span>
                {errFilter}
              </div>
            )}

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
                  <button type="button" className="btn btn-sm" onClick={() => muatRiwayat()}>
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            {stRiwayat === "ready" && riwayat.length === 0 && !filterRw && (
              <div className="empty">
                <span className="t">Belum ada catatan kehadiran</span>
                <p>
                  Setiap scan pekerja di mesin Revo akan muncul di sini beserta nama dan perannya.
                </p>
              </div>
            )}

            {stRiwayat === "ready" && riwayat.length === 0 && filterRw && (
              <div className="empty">
                <span className="t">Tidak ada catatan pada filter ini</span>
                <p>Coba longgarkan rentang tanggal, peran, atau kata kunci.</p>
                <button type="button" className="btn btn-sm" onClick={resetFilterRw}>
                  Hapus filter
                </button>
              </div>
            )}

            {stRiwayat === "ready" && riwayat.length > 0 && (
              <div className="tabel kolom-riwayat">
                <div className="thead" role="row" aria-hidden="true">
                  <span>No</span>
                  <span>User ID</span>
                  <span>Nama</span>
                  <span>Peran</span>
                  <span style={{ textAlign: "right" }}>Waktu</span>
                  <span style={{ textAlign: "right" }}>Aksi</span>
                </div>
                {errRw && (
                  <div className="msg msg-err" role="alert">
                    <span className="tag">Galat baris</span>
                    {errRw}
                  </div>
                )}
                {riwayat.map((r, i) => {
                  const deleting = hapusRwId === r.id;
                  const pending = pendingHapusRw === r.id;
                  return (
                    <div className="trow" key={r.id} role="row">
                      <span className="no" data-label="No">
                        {pad2(i + 1)}
                      </span>
                      <span className="p" data-label="User ID">
                        {r.user_id}
                      </span>
                      <span className="u" data-label="Nama">
                        {r.nama || "Tanpa nama"}
                      </span>
                      <span data-label="Peran">{r.role || "Tanpa peran"}</span>
                      <span className="waktu" data-label="Waktu">
                        {fmtWaktu(r.timestamp)}
                      </span>
                      <span className="ak" data-label="Aksi">
                        {pending ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => hapusBaris(r)}
                              disabled={deleting}
                            >
                              {deleting ? "Menghapus…" : "Ya, hapus"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setPendingHapusRw(null)}
                              disabled={deleting}
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => setPendingHapusRw(r.id)}
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
          </>
        )}
      </main>

      {tab === "pekerja" ? (
        <aside className="aside">
          <span className="k">Lembar sisipan · formulir</span>

          <form className="sheetlet" onSubmit={tambah}>
            <h2>Tambah Pekerja</h2>
            <div className="field">
              <label htmlFor="uid-baru">User ID</label>
              <input
                id="uid-baru"
                value={uidBaru}
                onChange={(e) => setUidBaru(e.target.value)}
                disabled={cBusy}
                maxLength={50}
                autoComplete="off"
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
              <select
                id="peran-baru"
                value={peranBaru}
                onChange={(e) => setPeranBaru(e.target.value)}
                disabled={cBusy}
              >
                {PERAN_OPSI.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
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
              User ID yang belum terdaftar tetap diterima saat scan: nama pekerja otomatis terisi{" "}
              <b>Belum Diberi Nama</b>, lalu tinggal diganti lewat tombol Ubah.
            </p>
            <p style={{ marginBottom: 12 }}>
              <b>Mengubah User ID ikut memindahkan seluruh riwayat absensinya</b> ke ID baru, jadi
              riwayat tidak terputus hanya karena ID diganti.
            </p>
            <p style={{ marginBottom: 12 }}>
              <b>Menghapus pekerja ikut menghapus seluruh riwayat absensinya</b>, jadi hapus hanya
              untuk yang sudah tidak bekerja.
            </p>
            <p style={{ marginBottom: 12 }}>
              Cari nama dan saringan peran hanya menyaring tampilan di layar; data tidak berubah.
            </p>
            <p className="jenis-code">
              HAPUS → KONFIRMASI DI BARIS
              <br />
              UBAH → EDIT LANGSUNG DI TABEL
              <br />
              GANTI USER ID → RIWAYAT IKUT PINDAH
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
              dari daftar pekerja lewat User ID yang sama.
            </p>
            <p style={{ marginBottom: 12 }}>
              Cari nama, saring peran, dan batasi rentang tanggal sekaligus; hasil langsung
              disaring server, maksimal 500 catatan terakhir.
            </p>
            <p style={{ marginBottom: 12 }}>
              Tombol <b>Hapus</b> pada satu baris hanya menghapus catatan itu; pekerja tetap
              terdaftar.
            </p>
            <p className="jenis-code">
              SUMBER → REVO_ATTEND × REVO_USERS
              <br />
              FILTER → NAMA, PERAN, TANGGAL AWAL &amp; AKHIR
              <br />
              URUT → NAMA / TANGGAL, ASC &amp; DESC
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
