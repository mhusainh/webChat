// Satu sumber tampilan baris log: dipakai Status Lanjutan (Trigger)
// dan Log Absensi supaya format waktu & pesan selalu sama.
export const formatWaktu = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .toUpperCase();
};

// n8n mengirim response sebagai pesan: tampilkan pesannya langsung.
// JSON hanya cadangan kalau tidak ada kunci pesan.
export const isiResponse = (isi) => {
  if (isi == null) return "(tanpa isi)";
  if (typeof isi === "string") return isi;
  if (typeof isi === "object") {
    if (!Array.isArray(isi) && Object.keys(isi).length === 0) return "(tanpa isi)";
    const pesan = !Array.isArray(isi) && (isi.pesan ?? isi.message);
    if (typeof pesan === "string" && pesan.trim().length > 0) return pesan;
    try {
      return JSON.stringify(isi);
    } catch {
      return String(isi);
    }
  }
  return String(isi);
};
