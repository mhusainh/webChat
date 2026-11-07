import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trigger from "./pages/Trigger";
import KaryawanKhususPage from "./pages/KaryawanKhusus";
import LogAbsensiPage from "./pages/LogAbsensi";

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function RequireAuth({ sheet, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Shell sheet={sheet}>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <RequireAuth sheet="01/04 DASBOR">
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/trigger"
        element={
          <RequireAuth sheet="02/04 TRIGGER">
            <Trigger />
          </RequireAuth>
        }
      />
      <Route
        path="/karyawan-khusus"
        element={
          <RequireAuth sheet="03/04 KARYAWAN KHUSUS">
            <KaryawanKhususPage />
          </RequireAuth>
        }
      />
      <Route
        path="/log-absensi"
        element={
          <RequireAuth sheet="04/04 LOG ABSENSI">
            <LogAbsensiPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}