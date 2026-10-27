import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const tanggalHariIni = () =>
  new Date()
    .toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

export default function Shell({ sheet, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="shell">
      <header className="tb">
        <div className="cell brand">
          <span className="name">Web Chat</span>
          <span className="sub">SISTEM AKUN &amp; TRIGGER N8N</span>
        </div>
        <div className="cell">
          <span className="k">Pengguna</span>
          <span className="v">{user}</span>
        </div>
        <div className="cell">
          <span className="k">Lembar</span>
          <span className="v">{sheet}</span>
        </div>
        <div className="cell">
          <span className="k">Tanggal</span>
          <span className="v">{tanggalHariIni()}</span>
        </div>
        <div className="cell grow" />
        <div className="cell">
          <button type="button" className="tb-out" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>
      <div className="layout">
        <nav className="rail" aria-label="Indeks lembar">
          <NavLink to="/" end className={({ isActive }) => "tab" + (isActive ? " on" : "")}>
            <span className="n">01</span>
            <span className="t">Dasbor</span>
          </NavLink>
          <NavLink to="/trigger" className={({ isActive }) => "tab" + (isActive ? " on" : "")}>
            <span className="n">02</span>
            <span className="t">Trigger</span>
          </NavLink>
          <NavLink to="/karyawan-khusus" className={({ isActive }) => "tab" + (isActive ? " on" : "")}>
            <span className="n">03</span>
            <span className="t">Karyawan Khusus</span>
          </NavLink>
          <div className="railmeta">
            <span className="k">Catatan lembar</span>
            <div className="row">
              <span>SESI AKSES</span>
              <span>60 MNT</span>
            </div>
            <div className="row">
              <span>BAHASA</span>
              <span>ID</span>
            </div>
            <div className="row">
              <span>REV UI</span>
              <span>02</span>
            </div>
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}
