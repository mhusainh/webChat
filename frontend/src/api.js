const BASE = import.meta.env.VITE_API_BASE || "/api";

const store = {
  get access() {
    return localStorage.getItem("wc_access");
  },
  get refresh() {
    return localStorage.getItem("wc_refresh");
  },
  set(access, refresh) {
    localStorage.setItem("wc_access", access);
    localStorage.setItem("wc_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("wc_access");
    localStorage.removeItem("wc_refresh");
  },
};

export function decodeUser() {
  const t = store.access;
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    return typeof payload.username === "string" && payload.username ? payload.username : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
  }
}

export function pesanApi(e) {
  if (!(e instanceof ApiError)) {
    return "Server tidak terjangkau. Periksa koneksi lalu coba lagi.";
  }
  if (e.status === 401) return "Sesi berakhir. Silakan masuk kembali.";
  if (e.status === 409) return "Nama pengguna sudah dipakai.";
  return e.message || "Terjadi galat.";
}

async function kirim(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(BASE + path, { ...options, headers });
}

async function refreshAccess() {
  const rt = store.refresh;
  if (!rt) return false;
  try {
    const res = await fetch(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) {
      store.clear();
      return false;
    }
    const data = await res.json();
    store.set(data.access_token, data.refresh_token || rt);
    return true;
  } catch {
    return false;
  }
}

export async function api(path, options = {}) {
  let res = await kirim(path, options, store.access);
  if (res.status === 401 && store.refresh) {
    const ok = await refreshAccess();
    if (ok) res = await kirim(path, options, store.access);
  }
  if (res.status === 401) {
    store.clear();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) store.clear();
    const detail = data && data.detail;
    throw new ApiError(
      res.status,
      typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : null
    );
  }
  return data;
}

export const tokenStore = store;
