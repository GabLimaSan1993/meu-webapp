// src/pages/TasksPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function TasksPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    async function loadUserAndData() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        navigate("/login");
        return;
      }

      const currentUser = data.user;
      setUser(currentUser);

      // Carrega nome na tabela profiles (campo "nome", chave "user_id")
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("nome")
          .eq("user_id", currentUser.id)
          .single();

        if (!profileError && profile?.nome) {
          setUserName(profile.nome);
        }
      } catch (e) {
        console.error("Erro ao carregar profile:", e);
      }

      // Carrega projetos associados ao usuário
      try {
        setLoadingProjects(true);
        const { data: projData, error: projError } = await supabase
          .from("projects")
          .select("*")
          .or(`manager_id.eq.${currentUser.id},consultant_to.eq.${currentUser.id}`)
          .order("created_at", { ascending: false });

        if (projError) {
          console.error("Erro ao buscar projetos:", projError);
        } else {
          setProjects(projData || []);
        }
      } catch (e) {
        console.error("Erro inesperado ao buscar projetos:", e);
      } finally {
        setLoadingProjects(false);
      }
    }

    loadUserAndData();
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => {
    const s = (p.status || "").toLowerCase();
    return (
      s.includes("andamento") ||
      s.includes("análise") ||
      s.includes("analise")
    );
  }).length;

  const mostRecentProject = projects[0] || null;

  const isRouteActive = (path) => location.pathname === path;

  return (
    <div style={rootWrapper}>
      {/* SIDEBAR */}
      <aside style={sidebar}>
        <div style={sidebarHeader}>
          <img src={xchangeLogo} alt="XChange" style={sidebarLogoImg} />
          <div>
            <div style={sidebarBrandTitle}>XChange</div>
            <div style={sidebarBrandSubtitle}>Painel de projetos</div>
          </div>
        </div>

        <nav style={sidebarNav}>
          <Link
            to="/app"
            style={{
              ...navItem,
              ...(isRouteActive("/app") ? navItemActive : {}),
            }}
          >
            Início
          </Link>

          <Link
            to="/projects/status"
            style={{
              ...navItem,
              ...(isRouteActive("/projects/status") ? navItemActive : {}),
            }}
          >
            Status dos projetos
          </Link>

          {/* Espaço para futuros itens de menu */}
          <div style={navSectionLabel}>Módulos futuros</div>
          <button style={navItemDisabled} type="button">
            Tarefas & agenda
          </button>
          <button style={navItemDisabled} type="button">
            Dashboards & uploads
          </button>
        </nav>

        <div style={sidebarFooter}>
          <div style={sidebarUserBox}>
            <div style={sidebarUserName}>
              {userName || "Consultor(a)"}
            </div>
            <div style={sidebarUserEmail}>{user?.email}</div>
          </div>
          <button style={sidebarLogoutButton} onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={mainWrapper}>
        {/* TOPO – igual à imagem do “Painel do consultor” */}
        <header style={header}>
          <div>
            <h1 style={headerTitle}>Painel do consultor</h1>
            <p style={headerSubtitle}>
              Organize suas tarefas e acesse o status dos projetos.
            </p>
          </div>

          <div style={headerUserBlock}>
            <div style={headerUserEmail}>{user?.email}</div>
            {userName && (
              <div style={headerUserName}>{userName}</div>
            )}
          </div>
        </header>

        {/* LINHA PRINCIPAL: RESUMO + PAINEL DO USUÁRIO */}
        <section style={topGrid}>
          {/* CARD ESQUERDO – RESUMO / CENTRAL DE ATIVIDADES */}
          <div style={summaryCard}>
            <p style={sectionLabel}>RESUMO</p>
            <h2 style={summaryTitle}>Central de atividades</h2>
            <p style={summaryText}>
              Esta tela será a sua central de tarefas, agendas e entregáveis.
              Por enquanto, use o botão abaixo para acessar o acompanhamento de
              projetos e cadastrar/editar oportunidades.
            </p>

            <button
              style={primaryButton}
              type="button"
              onClick={() => navigate("/projects/status")}
            >
              Ver status dos projetos
            </button>
          </div>

          {/* CARD DIREITO – PAINEL DO USUÁRIO */}
          <div style={userPanelWrapper}>
            <p style={sectionLabel}>PAINEL DO USUÁRIO</p>

            <div style={userPanelGrid}>
              {/* TAREFAS */}
              <div style={smallCard}>
                <h3 style={smallCardTitle}>Tarefas</h3>
                <p style={smallCardText}>
                  Recurso de tarefas ainda não está configurado no banco.
                </p>
              </div>

              {/* PROJETOS ASSOCIADOS */}
              <div style={smallCard}>
                <h3 style={smallCardTitle}>Projetos associados</h3>
                {loadingProjects ? (
                  <p style={smallCardText}>Carregando...</p>
                ) : (
                  <>
                    <div style={projectsCountRow}>
                      <span style={projectsCountNumber}>
                        {totalProjects}
                      </span>
                      <span style={projectsCountLabel}>
                        projetos no total
                      </span>
                    </div>
                    <p style={projectsCountDetail}>
                      {activeProjects} em andamento / análise
                    </p>

                    <button
                      type="button"
                      style={linkButton}
                      onClick={() => navigate("/projects/status")}
                    >
                      Abrir módulo de projetos →
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AGENDA DA SEMANA */}
            <div style={agendaCard}>
              <h3 style={smallCardTitle}>Agenda da semana</h3>
              <p style={smallCardText}>
                Integração futura com Outlook / calendário. Por enquanto, use
                este resumo para organizar seus compromissos.
              </p>

              <div style={agendaList}>
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
          </div>
        </section>

        {/* PROJETOS RECENTES – faixa inferior */}
        <section style={recentSection}>
          <p style={sectionLabel}>PROJETOS RECENTES</p>

          {loadingProjects ? (
            <p style={summaryText}>Carregando projetos...</p>
          ) : !mostRecentProject ? (
            <div style={recentCard}>
              <p style={summaryText}>
                Nenhum projeto encontrado. Use o módulo de projetos para criar
                novas oportunidades.
              </p>
            </div>
          ) : (
            <div style={recentCard}>
              <div style={recentProjectMain}>
                <div>
                  <div style={recentProjectTitle}>
                    {mostRecentProject.title || "Projeto sem nome"}
                  </div>
                  <div style={recentProjectSubtitle}>
                    {mostRecentProject.observacoes ||
                      mostRecentProject.description ||
                      "Sem observações cadastradas."}
                  </div>
                </div>

                <div style={recentStatusPill}>
                  {mostRecentProject.status || "Sem status"}
                </div>
              </div>

              <div style={recentProjectMeta}>
                <span>
                  Criado em{" "}
                  {mostRecentProject.created_at
                    ? new Date(
                        mostRecentProject.created_at
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
                <button
                  type="button"
                  style={linkButton}
                  onClick={() => navigate("/projects/status")}
                >
                  Ver todos os projetos →
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ======= ESTILOS ======= */

const rootWrapper = {
  display: "flex",
  minHeight: "100vh",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

/* SIDEBAR */

const sidebar = {
  width: "250px",
  backgroundColor: "#020617",
  borderRight: "1px solid rgba(31,41,55,0.9)",
  padding: "1.2rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.2rem",
};

const sidebarHeader = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  paddingBottom: "0.6rem",
  borderBottom: "1px solid rgba(31,41,55,0.9)",
};

const sidebarLogoImg = {
  height: "26px",
  objectFit: "contain",
};

const sidebarBrandTitle = {
  fontSize: "0.9rem",
  fontWeight: 600,
};

const sidebarBrandSubtitle = {
  fontSize: "0.75rem",
  color: "#9ca3af",
};

const sidebarNav = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  marginTop: "0.4rem",
};

const navItem = {
  padding: "0.55rem 0.75rem",
  borderRadius: "0.7rem",
  fontSize: "0.85rem",
  color: "#e5e7eb",
  textDecoration: "none",
  border: "1px solid transparent",
  backgroundColor: "transparent",
  textAlign: "left",
  cursor: "pointer",
};

const navItemActive = {
  background:
    "linear-gradient(135deg, rgba(250,204,21,0.1), rgba(250,204,21,0.25))",
  border: "1px solid rgba(250,204,21,0.8)",
  color: "#facc15",
};

const navSectionLabel = {
  marginTop: "0.8rem",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6b7280",
};

const navItemDisabled = {
  ...navItem,
  opacity: 0.4,
  cursor: "default",
};

const sidebarFooter = {
  marginTop: "auto",
  borderTop: "1px solid rgba(31,41,55,0.9)",
  paddingTop: "0.8rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const sidebarUserBox = {
  fontSize: "0.8rem",
};

const sidebarUserName = {
  fontWeight: 600,
};

const sidebarUserEmail = {
  fontSize: "0.74rem",
  color: "#9ca3af",
};

const sidebarLogoutButton = {
  marginTop: "0.2rem",
  padding: "0.45rem 0.75rem",
  borderRadius: "0.7rem",
  border: "1px solid rgba(148,163,184,0.6)",
  backgroundColor: "transparent",
  color: "#e5e7eb",
  fontSize: "0.8rem",
  cursor: "pointer",
};

/* MAIN */

const mainWrapper = {
  flex: 1,
  padding: "1.4rem 2rem 1.6rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.3rem",
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const headerTitle = {
  fontSize: "1.4rem",
  fontWeight: 600,
  margin: 0,
};

const headerSubtitle = {
  margin: 0,
  marginTop: "0.2rem",
  fontSize: "0.9rem",
  color: "#9ca3af",
};

const headerUserBlock = {
  textAlign: "right",
  fontSize: "0.8rem",
};

const headerUserEmail = {
  fontWeight: 600,
};

const headerUserName = {
  color: "#9ca3af",
};

const topGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.8fr)",
  gap: "1.2rem",
};

const sectionLabel = {
  fontSize: "0.72rem",
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "0.4rem",
};

const summaryCard = {
  backgroundColor: "#020617",
  borderRadius: "1rem",
  border: "1px solid rgba(31,41,55,0.9)",
  padding: "1.3rem 1.4rem",
  boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
};

const summaryTitle = {
  fontSize: "1.2rem",
  fontWeight: 600,
  margin: 0,
  marginBottom: "0.6rem",
};

const summaryText = {
  fontSize: "0.9rem",
  color: "#d1d5db",
  margin: 0,
  maxWidth: "40rem",
};

const primaryButton = {
  marginTop: "1rem",
  padding: "0.8rem 1.3rem",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #facc15, #eab308)",
  color: "#111827",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
};

const userPanelWrapper = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
};

const userPanelGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.2fr)",
  gap: "0.8rem",
};

const smallCard = {
  backgroundColor: "#020617",
  borderRadius: "0.9rem",
  border: "1px solid rgba(31,41,55,0.9)",
  padding: "0.9rem 1rem",
};

const smallCardTitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  margin: 0,
  marginBottom: "0.4rem",
};

const smallCardText = {
  fontSize: "0.82rem",
  color: "#d1d5db",
  margin: 0,
};

const projectsCountRow = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.3rem",
  marginTop: "0.15rem",
};

const projectsCountNumber = {
  fontSize: "1.6rem",
  fontWeight: 700,
  color: "#facc15",
};

const projectsCountLabel = {
  fontSize: "0.8rem",
  color: "#d1d5db",
};

const projectsCountDetail = {
  marginTop: "0.3rem",
  fontSize: "0.8rem",
  color: "#9ca3af",
};

const linkButton = {
  marginTop: "0.4rem",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#facc15",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};

const agendaCard = {
  ...smallCard,
  marginTop: "0.1rem",
};

const agendaList = {
  marginTop: "0.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.8rem",
};

const agendaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
};

const agendaDay = {
  color: "#e5e7eb",
};

const agendaInfo = {
  color: "#9ca3af",
};

/* PROJETOS RECENTES */

const recentSection = {
  marginTop: "0.4rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const recentCard = {
  backgroundColor: "#020617",
  borderRadius: "1rem",
  border: "1px solid rgba(31,41,55,0.9)",
  padding: "0.9rem 1.1rem",
};

const recentProjectMain = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const recentProjectTitle = {
  fontSize: "0.95rem",
  fontWeight: 600,
};

const recentProjectSubtitle = {
  fontSize: "0.82rem",
  color: "#9ca3af",
};

const recentStatusPill = {
  padding: "0.25rem 0.7rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.8)",
  fontSize: "0.75rem",
};

const recentProjectMeta = {
  marginTop: "0.5rem",
  display: "flex",
  justifyContent: "space-between",
  fontSize: "0.78rem",
  color: "#9ca3af",
};

export default TasksPage;
