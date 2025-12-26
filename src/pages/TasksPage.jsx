// src/pages/TasksPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function TasksPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate("/login");
        return;
      }

      setUser(data.user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      setProfile(profileData || null);
    }

    loadUser();
  }, [navigate]);

  const userName = profile?.nome || "Consultor(a)";
  const userEmail = profile?.email || user?.email || "";

  return (
    <div style={pageWrapper}>
      {/* TOPO */}
      <header style={header}>
        <div style={headerLeft}>
          <img src={xchangeLogo} alt="XChange" style={topLogo} />
          <div>
            <p style={topLabel}>XChange</p>
            <h1 style={topTitle}>Painel do consultor</h1>
            <p style={topSubtitle}>
              Organize suas tarefas e acesse o status dos projetos.
            </p>
          </div>
        </div>

        <div style={headerRight}>
          <div style={userInfo}>
            <span style={userNameStyle}>{userName}</span>
            <span style={userEmailStyle}>{userEmail}</span>
          </div>
          <button
            style={logoutButton}
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={mainGrid}>
        {/* RESUMO */}
        <section style={summaryCard}>
          <p style={sectionLabel}>Resumo</p>
          <h2 style={sectionTitle}>Central de atividades</h2>
          <p style={sectionText}>
            Esta tela será a sua central de tarefas, agendas e entregáveis. Por
            enquanto, use o botão abaixo para acessar o acompanhamento de
            projetos e cadastrar/editar oportunidades.
          </p>

          <button
            style={primaryButton}
            onClick={() => navigate("/projects/status")}
          >
            Ver status dos projetos
          </button>
        </section>

        {/* PAINEL DO USUÁRIO */}
        <section style={userPanel}>
          <p style={sectionLabel}>Painel do usuário</p>

          <div style={userPanelGrid}>
            {/* Bloco Tarefas */}
            <div style={smallCard}>
              <h3 style={smallCardTitle}>Tarefas</h3>
              <p style={smallCardText}>
                Em breve você verá aqui as tarefas criadas por você ou
                atribuídas a você.
              </p>
              <Link to="/tasks/manage" style={smallCardLink}>
                Abrir módulo de tarefas →
              </Link>
            </div>

            {/* Bloco Projetos associados (placeholder) */}
            <div style={smallCard}>
              <h3 style={smallCardTitle}>Projetos associados</h3>
              <p style={smallCardKpi}>1</p>
              <p style={smallCardText}>1 em andamento / análise</p>
              <button
                style={ghostButton}
                onClick={() => navigate("/projects/status")}
              >
                Abrir módulo de projetos →
              </button>
            </div>
          </div>

          {/* Agenda da semana (placeholder) */}
          <div style={agendaCard}>
            <h3 style={smallCardTitle}>Agenda da semana</h3>
            <p style={smallCardText}>
              Integração futura com Outlook / calendário. Por enquanto, use este
              resumo para organizar seus compromissos.
            </p>

            <div style={agendaGrid}>
              {["QUI. • 04/12", "SEX. • 05/12", "SÁB. • 06/12", "DOM. • 07/12", "SEG. • 08/12"].map(
                (day) => (
                  <div key={day} style={agendaRow}>
                    <span style={agendaDay}>{day}</span>
                    <span style={agendaInfo}>Sem eventos cadastrados</span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </main>

      {/* PROJETOS RECENTES (placeholder) */}
      <section style={recentProjectsWrapper}>
        <p style={sectionLabel}>Projetos recentes</p>
        <div style={recentProjectCard}>
          <div>
            <p style={recentProjectTitle}>Nome do projeto exemplo</p>
            <p style={recentProjectMeta}>Criado em 02/12</p>
          </div>
          <span style={statusPill}>Em Andamento</span>
        </div>
      </section>
    </div>
  );
}

/* ======== ESTILOS ======== */

const pageWrapper = {
  minHeight: "100vh",
  width: "100%",
  padding: "1.5rem 2rem 2rem",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1.5rem",
};

const headerLeft = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const topLogo = {
  height: "40px",
  objectFit: "contain",
};

const topLabel = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "0.1rem",
};

const topTitle = {
  fontSize: "1.4rem",
  fontWeight: 600,
  margin: 0,
};

const topSubtitle = {
  fontSize: "0.9rem",
  color: "#9ca3af",
  marginTop: "0.2rem",
};

const headerRight = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const userInfo = {
  textAlign: "right",
  fontSize: "0.8rem",
};

const userNameStyle = {
  display: "block",
  fontWeight: 600,
};

const userEmailStyle = {
  display: "block",
  color: "#9ca3af",
};

const logoutButton = {
  padding: "0.5rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.6)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.1fr) minmax(0, 1.4fr)",
  gap: "1.2rem",
  alignItems: "flex-start",
};

const sectionLabel = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "0.4rem",
};

const sectionTitle = {
  fontSize: "1.25rem",
  fontWeight: 600,
  marginBottom: "0.4rem",
};

const sectionText = {
  fontSize: "0.9rem",
  color: "#d1d5db",
  maxWidth: "40rem",
};

const summaryCard = {
  background:
    "radial-gradient(circle at top left, rgba(250,204,21,0.12), transparent 55%), #020617",
  borderRadius: "1rem",
  padding: "1.4rem 1.6rem",
  border: "1px solid rgba(55,65,81,0.9)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.8)",
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
};

const primaryButton = {
  marginTop: "0.7rem",
  alignSelf: "flex-start",
  padding: "0.75rem 1.4rem",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #facc15, #eab308)",
  color: "#111827",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
};

const userPanel = {
  backgroundColor: "#020617",
  borderRadius: "1rem",
  padding: "1.1rem 1.3rem",
  border: "1px solid rgba(55,65,81,0.9)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.8)",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const userPanelGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.75rem",
};

const smallCard = {
  backgroundColor: "#020617",
  borderRadius: "0.85rem",
  padding: "0.85rem 0.95rem",
  border: "1px solid rgba(55,65,81,0.9)",
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const smallCardTitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
};

const smallCardText = {
  fontSize: "0.8rem",
  color: "#d1d5db",
};

const smallCardKpi = {
  fontSize: "1.5rem",
  fontWeight: 700,
};

const smallCardLink = {
  marginTop: "0.4rem",
  fontSize: "0.8rem",
  color: "#facc15",
  textDecoration: "none",
  fontWeight: 500,
};

const ghostButton = {
  marginTop: "0.4rem",
  alignSelf: "flex-start",
  padding: "0.45rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.6)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

const agendaCard = {
  marginTop: "0.4rem",
  backgroundColor: "#020617",
  borderRadius: "0.85rem",
  border: "1px solid rgba(55,65,81,0.9)",
  padding: "0.9rem 0.95rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const agendaGrid = {
  marginTop: "0.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const agendaRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "0.78rem",
};

const agendaDay = {
  color: "#e5e7eb",
};

const agendaInfo = {
  color: "#9ca3af",
};

const recentProjectsWrapper = {
  marginTop: "0.5rem",
  backgroundColor: "#020617",
  borderRadius: "1rem",
  border: "1px solid rgba(31,41,55,0.9)",
  padding: "0.9rem 1rem",
};

const recentProjectCard = {
  marginTop: "0.4rem",
  borderRadius: "0.8rem",
  backgroundColor: "#020617",
  border: "1px solid rgba(55,65,81,0.9)",
  padding: "0.85rem 0.9rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const recentProjectTitle = {
  fontSize: "0.9rem",
  fontWeight: 500,
};

const recentProjectMeta = {
  fontSize: "0.78rem",
  color: "#9ca3af",
};

const statusPill = {
  padding: "0.3rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid rgba(34,197,94,0.7)",
  color: "#bbf7d0",
  fontSize: "0.78rem",
};

export default TasksPage;
