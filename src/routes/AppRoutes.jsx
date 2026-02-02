// src/routes/AppRoutes.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Páginas públicas
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";

// Páginas internas
import TasksPage from "../pages/TasksPage";
import ProjectsStatusPage from "../pages/ProjectsStatusPage";
import TasksManagerPage from "../pages/TasksManagerPage";
import UploadPage from "../pages/UploadPage";

// Layout
import SidebarLayout from "../components/SidebarLayout";

// Dashboards
import FaturamentoDashboard from "../pages/dashboards/FaturamentoDashboard";
import ContasPagarDashboard from "../pages/dashboards/ContasPagarDashboard";
import ContasReceberDashboard from "../pages/dashboards/ContasReceberDashboard"; // ✅ NOVO

/* =========================
   ROTA PROTEGIDA
========================= */
function ProtectedRoute({ children }) {
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
  return children;
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

        {/* HOME */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <TasksPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* STATUS & PROSPECÇÃO */}
        <Route
          path="/projects/status"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <ProjectsStatusPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* TAREFAS */}
        <Route
          path="/tasks/manage"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <TasksManagerPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* UPLOADS */}
        <Route
          path="/uploads"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <UploadPage />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* DASHBOARD FATURAMENTO */}
        <Route
          path="/dashboards/faturamento"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <FaturamentoDashboard />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* DASHBOARD CONTAS A PAGAR */}
        <Route
          path="/dashboards/contas-pagar"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <ContasPagarDashboard />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* ✅ DASHBOARD CONTAS A RECEBER */}
        <Route
          path="/dashboards/contas-receber"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <ContasReceberDashboard />
              </SidebarLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
