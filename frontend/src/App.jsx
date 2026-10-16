import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trigger from "./pages/Trigger";

function RequireAuth({ sheet, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Shell sheet={sheet}>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth sheet="01/03 · DASBOR">
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/trigger"
        element={
          <RequireAuth sheet="02/03 · TRIGGER">
            <Trigger />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
