# n8n Workflow — Gaji

> **Status redesign:** direct-device (zklib-js) + script Python cek/buat file bulanan.
> User paste manual ke n8n (update_workflow MCP tidak dipakai).

## Nama Workflow
**Gaji** (`SEzLqfN9OCgvFOcF`)
URL: `https://n8n.putraperkasamuria.my.id/workflow/SEzLqfN9OCgvFOcF`

---

## Tujuan (Final)

Setiap hari **08:00 WIB**:

1. **Check if need to Copy Excel** — cek file gaji bulan berjalan; kalau belum ada dan hari ini belum tercakup spill bulan lalu, copy template + remap header tanggal di 5 sheet (Absensi/Pulsa/UM Gudang/UM Khusus grid Ahad; Lembur grid Sabtu) + clear data lama di kolom tanggal.
2. **Get Revo** — ambil attlog langsung dari mesin **Fingerspot Revo W-230N** (TCP 4370, zklib-js), window: kemarin `JAM_MULAI` (05:00) → hari ini `JAM_AKHIR` (08:00).
3. **Input to excel** — hitung absensi (`1.0`), pulsa mandor (`1`), lembur interval (I–IV); tulis ke file bulanan matrix (bukan 3 sheet lama).

Cloud API `developer.fingerspot.io` + credential Bearer **dihapus** — n8n server & Revo satu LAN/VPN (opsi C).

---

## Alur Node (Final — 8 node)

```
Schedule Trigger (08:00 Asia/Jakarta)
  │
  ▼
Config (Set v3.5, mode manual)     ← user isi BASE_DIR, TEMPLATE_FILE, DEVICE_HOST
  │
  ▼
Check if need to Copy Excel
  Execute Command → CLI "Check if need to Copy Excel.py"
  → status: exists | handled_in_previous | created | gagal
  │
  ▼
Get Revo (Hitung Rentang + Ambil Attlog)
  Code: hitung window + nama file
  Execute Command: node /tmp/gaji/zk/ambil_attlog.js HOST PORT START END
  → stdout JSON satu baris (records + error, exit selalu 0)
  │
  ▼
Input to excel (Proses & Tulis)
  Code: parse attlog → absensi / pulsa / lembur
  Execute Command: openpyxl tulis sel matrix
  │
  ▼
Ringkasan Eksekusi (Code)
```

File JS final (paste ke Code node):
| Node | File |
|------|------|
| Get Revo (Code) | `hitung_final.js` |
| Input to excel (Code) | `proses_final.js` |
| Ringkasan | `ringkasan.js` |

Bundle device: `zk_bundle.js` (esbuild, 26 KB) — deploy ke server n8n sebagai `ambil_attlog.js` (runner argv: host port start end).

---

## Config — 12 field (Set v3.5, mode manual)

| Field | Default | Keterangan |
|-------|---------|------------|
| `BASE_DIR` | *(user isi)* | Folder berisi file gaji bulanan |
| `TEMPLATE_FILE` | *(user isi)* | Path template `.xlsm` |
| `DEVICE_HOST` | *(user isi)* | IP Revo di LAN/VPN |
| `DEVICE_PORT` | `4370` | Port zklib default |
| `JAM_MULAI` | `5` | 05:00 (kemarin) |
| `JAM_AKHIR` | `8` | 08:00 (hari ini) |
| `KOLUM_MANDOR` | `Mandor` | Header kolom di sheet jadwal (jika masih dipakai) |
| `sheet_absensi` | `absensi` | |
| `sheet_pulsa` | `pulsa` | |
| `sheet_lembur` | `lembur` | |
| `FILE_PREFIX` | `Absensi` | |
| `LEMBUR_GAP_MAKS` | `16` | Jam — batas jarak antar scan |

**Dihapus** (user: tidak butuh): `LEMBUR_MODE`, `LEMBUR_FLAT`, `FLAT_JAM`, cloud credentials.

JSON assignments lengkap sudah diberikan via handoff; user isi path + IP sendiri.

---

## File Gaji Bulanan

### Naming
```
{M}. GAJI KARYAWAN {BULAN} {Tahun}.xlsm
```
Tanpa leading zero:
- `10. GAJI KARYAWAN OKTOBER 2026.xlsm`
- `9. GAJI KARYAWAN SEPTEMBER 2026.xlsm`

### Alur cek/buat (`Check if need to Copy Excel.py`)

Artefak final: `Z:\...\GAJI (R&D)\Code\Check if need to Copy Excel.py`
(eksplorasi lama `cek_buat_file_gaji.py` sudah digantikan; SHA256 disamakan dari copy workshop).

Dipanggil via CLI (atau `--json '{...}'`):

```bash
python "Check if need to Copy Excel.py" \
  --today 2026-10-21 \
  --base-dir "/path/gaji" \
  --template "/path/9. GAJI KARYAWAN SEPTEMBER 2026 .xlsm"
```

`--template` = path file template asli (boleh file produksi pun — semua operasi hanya
menulis salinan di `--base-dir`; clear data aman karena formula & kolom luar blok dilewati).

**Output:** satu baris JSON stdout, exit selalu `0`.

| `status` | Arti | `action` |
|----------|------|----------|
| `exists` | File bulan ini sudah ada + tanggal hari ini di region sendiri | `none` |
| `handled_in_previous` | Hari ini sudah ter-spill di file bulan lalu | `none` |
| `handled_in_next` | Hari ini sudah ter-spill di file bulan depan | `none` |
| `created` | File baru dibuat dari template | `created` |
| `gagal` / `error` | Template tak ada / struktur tak terdeteksi / target sudah ada tapi tanggal tak terdeteksi (`TARGET_SUDAH_ADA`, tolak timpa) | `none` |

**Spill check:** bila file bulan ini belum ada → buka file bulan sebelumnya → cari angka `today.day` di **setelah** kolom tanggal terakhir bulan itu. Ketemu → jangan bikin file baru.

### Sheet yang diproses (keputusan user — final)

Saat **create**, script hanya menyentuh 5 sheet ini:

| Sheet | Grid header tanggal | Catatan |
|-------|---------------------|---------|
| Absensi | **Ahad-based**, 5 blok 7 kolom (F–L, O–U, X–AD, AG–AM, AP–AV) | **satu-satunya** sheet yang judulnya ditulis: `D3` = bulan, `E3` = tahun |
| Pulsa | Ahad-based (F–L, Q–W, AB–AH, AM–AS, AX–BD) | `D3/E3` formula `=Absensi!D3` → auto ikut; tarif `N8=10000` tak disentuh |
| UM Gudang | Ahad-based (I–O, Z–AF, AQ–AW, BH–BN, BY–CE — full-width kolom 83) | deteksi scan penuh tanpa cap 80 (blok terakhir utuh) |
| UM Khusus | Ahad-based (F–L … AX–BD) | junk template (`AL=22`, `BE=4`) otomatis dibuang deteksi (header kosong + cap 7); formula `G89/AQ89` dipertahankan |
| Lembur | **Sabtu-based**, 5 section vertikal | tanggal baris 8/93/178/263/348, anchor kolom E,I,M,Q,U,Y,AC (pitch 4) |

Sheet lain (**Um gangguan dan Um Fais + Qoiz**, Karyawan, Report, Slip, Gaji …, PT. …,
HUTANG) **tidak disentuh** — termasuk judul "PERIODE SEPTEMBER …" di sheet Gaji
(stale; dibiarkan sampai user minta).

### Bersihkan data lama (saat create)

- Sel data lama hanya dikosongkan **di kolom tanggal** kelima sheet di atas (baris setelah baris tanggal).
- Kolom Jml/Jumlah (SUM/SUBTOTAL), tarif, nama karyawan, dan seluruh formula **tidak disentuh** (guard `=`); `MergedCell` tidak ditulis.
- Lembur: hanya kolom tanggal E..AF per section — sub-header `I/II/III/IV` (tgl+1) & label `Minggu I..V` utuh.
- Validasi E2E vs template asli: formula identik, sheet non-proses identik sel-ke-sel.

### Grid minggu (Ahad-based)

- Minggu = Ahad..Sabtu.
- Minggu pertama berisi tanggal 1 (bisa menyertakan tanggal bulan sebelumnya → spill awal).
- **Minggu terakhir** — `k` = jumlah tanggal bulan ini di blok itu:
  - **k ≥ 4** (Rabu..Sabtu): tulis sisa; slot kosong diisi tanggal 1.. bulan depan (spill akhir).
  - **k ≤ 3** (Ahad..Selasa): **buang** minggu itu dari file ini; tanggal sisa jadi spill awal file bulan depan.

Contoh 2026:
| Bulan | Berakhir | k | Grid terakhir |
|-------|----------|---|---------------|
| Agustus | Senin 31 | 2 | M5 = 23–29 saja; 30–31 → file Sep M1 |
| September | Rabu 30 | 4 | M5 = 27–30 + (1)(2)(3) Okt |
| Oktober | Sabtu 31 | 7 | M5 = 25–31 penuh, tanpa spill |

Libur: **library `holidays` = sumber utama** (`pip install -r requirements.txt` — sudah terpasang di mesin dev; tanggal Islam 2026 akurat: Isra Mi'raj 16 Jan, Fitri 21–22 Mar, Waisak 31 Mei, Tahun Baru Islam 16 Jun, Maulid 25 Aug). Hardcode `LIBUR_2026` hanya **fallback** kalau library tak ada. Catatan: lib ikut menandai Easter Sunday — tak berdampak visual karena Ahad sudah merah. Font **merah** di sel tanggal untuk libur nasional & Ahad.

### Grid Lembur (Sabtu-based — beda konvensi!)

- Minggu = **Sabtu..Jumat** (sheet lain tetap Ahad..Sabtu). Ikuti file Sep klien: M1 = 29,30,31,1,2,3,4.
- Aturan spill **k ≥ 4 / k ≤ 3 sama**; deteksi 5 section via label `Per :` di kolom C (baris 6/91/176/261/346).
- Contoh Okt 2026 → 5 section: 26 Sep–2 Okt · 3–9 · 10–16 · 17–23 · 24–30.
  **31 Okt POP dari grid Sabtu → data lemburnya di file November** (file Nov dibuat saat flow D terpicu 1 Nov) — hari tail bisa beda target antar sheet, makanya JSON memuat `file_target_lembur` terpisah dari `file_target`.
- `file_target_lembur` (existence-aware): bulan sendiri (jika file sudah ada) → spill di bulan sebelumnya → spill di bulan depan → fallback kebenaran grid. Contoh: 2 Okt sebelum file Okt ada → `file_target_lembur` = file Sep (spill 1–2 Okt di section M5-nya).

### Template & pengisian

- File dibuat via **copy + rename**; openpyxl `keep_vba=True`.
- Template sudah berisi nama karyawan, struktur Minggu I–V, formula Jumlah — **jangan sentuh formula/Jumlah**.
- Format matrix **menggantikan** 3 sheet lama (`absensi/pulsa/lembur` tidak ada di template baru).
- Fase ini: cek + buat file + remap header tanggal + clear data lama di kolom tanggal. **Tulis nilai sel (1.0 / pulsa / lembur) = fase berikutnya.**
- Saat tulis nanti: tulis nilai kolom tanggal itu untuk semua nama; kosong → `-`. Untuk lembur gunakan `file_target_lembur`, bukan `file_target`.
- `deteksi_struktur()` / `deteksi_lembur()` heuristik (baris angka hari ≥5, blok kolom berdekatan, label `Per :` kolom C) — **sudah divalidasi against template asli user** (E2E Oktober 2026, 21/21).

---

## Get Revo — zklib langsung

- Protocol: TCP 4370 (zklib-js), **bukan** cloud API.
- Server n8n (Alpine) **tanpa Python/npm** → bundle sudah jadi (`zk_bundle.js` → deploy sebagai `/tmp/gaji/zk/ambil_attlog.js` via heredoc base64).
- Runner argv: `node ambil_attlog.js HOST PORT START END`.
- **stdout:** JSON satu baris (`{ok, records, error?}`); **exit selalu 0** (error sebagai JSON, bukan exit code).
- Decode attlog: `B64_AMBIL` = **satu file** CJS (bukan multi-file map) — sudah diperbaiki.
- Base64 di-chunk jadi array `.join('')` (120 char/baris) di `bangun_kode.py` agar output Read/Execute tidak terpotong.

### Pitfall yang sudah dihadapi
- PowerShell membuang arg `''` kosong → jangan andalkan arg kosong.
- `Get-Content -Raw | node` untuk pipe JS.
- PS 5.1 `Set-Content -Encoding utf8` menulis **BOM**.
- Output bash >51200 B / baris >2000 char terpotong (Read tool juga potong baris >2000 char).

---

## Input to excel — aturan isi (fase berikutnya)

| Data | Nilai | Catatan |
|------|-------|---------|
| Absensi | `1.0` | Orang hadir di tanggal itu |
| Pulsa | `1` | Hanya mandor yang hadir |
| Lembur | desimal jam | Interval-only (lihat bawah) |

### Lembur — mode interval (final, flat dihapus)

| Slot | Jam | Durasi |
|------|-----|--------|
| I | 16.00–18.00 | maks **2.0** |
| II | 18.00–21.00 | 3.0 |
| III | 21.00–24.00 | 3.0 |
| IV | 00.00–07.00 | maks **7.0** |

`LEMBUR_GAP_MAKS=16` — batas jarak antar scan. Split antar slot dari timestamp pulang (bukan flat).

---

## Test status

| Suite | Hasil |
|-------|-------|
| `tes_copy_excel.py` (dummy, flow A–D + lembur target) | **20/20 PASS** |
| `tes_e2e_template.py` (template asli, Oktober 2026) | **21/21 PASS** |
| `uji_proses.js` | **24 PASS / 0 FAIL** |
| `uji_ambil.js` | **8 PASS / 0 FAIL** |
| Grid Ahad & Sabtu (Ags/Sep/Okt/Mei/Jun/Des 2026) | sesuai aturan spill; Sat-grid reproduksi file Sep persis |
| Gate akhir | suite dijalankan dari artefak Z: — 20/20 PASS |

E2E mencakup: 5 blok Ahad di 4 sheet (incl. full-width UM Gudang & anti-junk UM Khusus), 5 section Sabtu Lembur (baris 8/93/178/263/348), sub-header I/II/III/IV utuh, D3/E3 (Absensi vs formula sheet lain), data lama ter-clear, formula identik, sheet non-proses identik sel-ke-sel, rerun → `exists`.

---

## Kontrak API (untuk wrapper n8n)

**Request:**
```json
{
  "today": "2026-10-21",
  "base_dir": "/path/gaji",
  "template": "/path/_template_gaji.xlsm"
}
```

**Response (sukses create — bentuk nyata hasil E2E):**
```json
{
  "ok": true,
  "today": "2026-10-15",
  "bulan": 10,
  "tahun": 2026,
  "file_bulanan": ".../10. GAJI KARYAWAN OKTOBER 2026.xlsm",
  "file_target": ".../10. GAJI KARYAWAN OKTOBER 2026.xlsm",
  "file_target_lembur": ".../10. GAJI KARYAWAN OKTOBER 2026.xlsm",
  "status": "created",
  "action": "created",
  "minggu_grid": 5,
  "lembur_minggu": 5,
  "blok_template": 5,
  "sel_tanggal_ditulis": 175,
  "minggu_dipakai": 5,
  "data_dibersihkan": 2854,
  "judul_diperbarui": true,
  "sheet_diproses": ["Absensi", "Pulsa", "UM Gudang", "UM Khusus", "Lembur"],
  "sheet_dilewati": [],
  "pesan": "File ... dibuat dari template. Grid 5 minggu, pakai 5 blok template. Sheet diproses: ..."
}
```

Field selalu ada di SEMUA status (ikut `result` awal): `file_bulanan`, `file_target`, **`file_target_lembur`**. Status `exists`/`handled_in_*` tidak punya key `minggu_grid`/`sheet_diproses` (hanya saat `created`).

n8n Code node: hit API (bukan Python runtime n8n) → parse JSON → logika IF `action == "created"` / `"none"` → lanjut Get Revo.

---

## Ralat dari Desain Lama

| Lama | Masalah | Sekarang |
|------|---------|----------|
| Cloud API + Bearer | Butuh internet + credential | **Direct TCP 4370** zklib |
| `pyzk` di server | Alpine tanpa Python | **zklib-js** (Node) |
| 3 sheet absensi/pulsa/lembur | Tidak ada di template baru | **Format matrix** file bulanan |
| Mode flat lembur | User tidak butuh | **Interval-only** I–IV |
| Copy file via bash `cp` tanpa cek spill | Salah di awal bulan | **Check if need to Copy Excel.py** (spill-aware, multi-sheet) |

---

## Pertanyaan Terbuka (butuh user)

*(kosong — semua terjawab)*

Selesai:
- ~~Judul stale sheet Gaji Jaringan/Admin/Topa/Purwadi~~ — user: **dibiarkan**. Create hanya menyentuh 5 sheet (Absensi, Pulsa, Lembur, UM Gudang, UM Khusus); judul "PERIODE SEPTEMBER …" di sheet lain sengaja tak di-update.
- ~~Libur 2026~~ — library `holidays` terpasang + di `requirements.txt`; hardcode jadi fallback.
- ~~`DEVICE_HOST`~~ — dikirim **lewat Config n8n** (Set node, field `DEVICE_HOST` → argv `node ambil_attlog.js HOST ...`); user edit di UI n8n, tanpa buka kode.
- ~~Validasi template asli~~ — E2E Oktober 2026, 21/21.
- ~~Format 31-hari/spill~~ — grid Des 2026 teruji; konvensi Sabtu Lembur final.

---

## Skills & Langkah Build (referensi)

Skills n8n yang dipakai sesi sebelumnya: `n8n-workflow-lifecycle-official`, `n8n-debugging-official`, `n8n-code-nodes-official`.

Urutan kerja frontend di repo ini (AGENTS.md): load `impeccable` → `antislop` → `ui-ux-pro-max` dst. — **tidak berlaku** untuk pekerjaan n8n/backend ini.

**Jangan ubah `backend/` FastAPI** kecuali diminta eksplisit (AGENTS.md).

Handoff manual ke user: tabel 8 node + mapping file paste + Config 12 field + parameter ExecuteCommand/IF + JSON assignments — sudah diberikan di chat; file JS final di folder kerja `...\Temp\opencode\gaji\`.
