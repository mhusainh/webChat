import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, pesanApi } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Isi nama pengguna dan kata sandi dulu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const tokens = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      login(tokens);
      navigate("/", { replace: true });
    } catch (err) {
      if (err && err.status === 401) {
        setError("Nama pengguna atau kata sandi salah.");
      } else {
        setError(pesanApi(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <header className="tb">
        <div className="cell brand">
          <span className="name">Web Chat</span>
          <span className="sub">SISTEM AKUN &amp; TRIGGER N8N</span>
        </div>
        <div className="cell">
          <span className="k">Lembar</span>
          <span className="v">00/03 · MASUK</span>
        </div>
        <div className="cell grow" />
      </header>
      <main className="login-sheet">
        <span className="ch tl" aria-hidden="true" />
        <span className="ch tr" aria-hidden="true" />
        <span className="ch bl" aria-hidden="true" />
        <span className="ch br" aria-hidden="true" />
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="k">Seksi 00 · Akses</span>
          <h1>Masuk</h1>
          <div className="field">
            <label htmlFor="username">Nama pengguna</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn btn-prim" disabled={busy}>
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
          {error && (
            <div className="msg msg-err" role="alert">
              <span className="tag">Galat</span>
              {error}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
