// src/routes/AppRoutes.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Páginas públicas
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";

// Páginas internas
import TasksPage from "../pages/TasksPage"; // HOME pós-login
import ProjectsStatusPage from "../pages/ProjectsStatusPage";
import TasksManagerPage from "../pages/TasksManagerPage";
import UploadPage from "../pages/UploadPage";

// Layout
import SidebarLayout from "../components/SidebarLayout";

// Dashboard
import FaturamentoDashboard from "../pages/dashboards/FaturamentoDashboard";

/* =========================
   ROTA PROTEGIDA (Outlet)
   ========================= */
function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  // ✅ importante: retorna o layout das rotas filhas
  return <SidebarLayout />;
}

/* =========================
   REDIRECIONAMENTO ROOT
   ========================= */
function IndexRedirect() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  return <Navigate to={hasSession ? "/app" : "/login"} replace />;
}

/* =========================
   ROTAS PRINCIPAIS
   ========================= */
export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Index */}
        <Route path="/" element={<IndexRedirect />} />

        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* ✅ Privadas: ProtectedRoute -> SidebarLayout -> Outlet */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<TasksPage />} />

          {/* Mantive seus paths exatamente como estão hoje */}
          <Route path="/projects/status" element={<ProjectsStatusPage />} />
          <Route path="/tasks/manage" element={<TasksManagerPage />} />
          <Route path="/uploads" element={<UploadPage />} />
          <Route path="/dashboards/faturamento" element={<FaturamentoDashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
