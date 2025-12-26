// src/routes/AppRoutes.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import TasksPage from "../pages/TasksPage";               // painel inicial
import ProjectsStatusPage from "../pages/ProjectsStatusPage";
import TasksManagerPage from "../pages/TasksManagerPage"; // página nova de tarefas
import SidebarLayout from "../components/SidebarLayout";

// Rota protegida simples
function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  return children;
}

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Início (Painel do consultor) */}
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

        {/* Projetos */}
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

        {/* Gestão de tarefas */}
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

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
