// src/routes/AppRoutes.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import TasksPage from "../pages/TasksPage";
import ProjectsStatusPage from "../pages/ProjectsStatusPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Tela principal (tarefas + sidebar) */}
        <Route path="/app" element={<TasksPage />} />

        {/* Nova tela estilo Notion para status de projetos */}
        <Route path="/projects/status" element={<ProjectsStatusPage />} />

        {/* Qualquer outra rota cai para login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
