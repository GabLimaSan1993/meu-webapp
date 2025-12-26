// src/components/SidebarLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import xchangeLogo from "../assets/xchange-logo.png";

function SidebarLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [userEmail, setUserEmail] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return;
      setUserEmail(data.user.email || "");
    }
    loadUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const activeKey = useMemo(() => {
    const p = location.pathname || "";
    if (p === "/app") return "home";
    if (p.startsWith("/projects")) return "projects";
    if (p.startsWith("/tasks")) return "tasks";
    return "";
  }, [location.pathname]);

  return (
    <div style={layoutWrapper}>
      <aside style={{ ...sidebar, width: collapsed ? "92px" : "248px" }}>
        {/* Topo */}
        <div style={topBar}>
          <div style={brandRow}>
            <div style={logoBox}>
              <img src={xchangeLogo} alt="XChange" style={brandLogo} />
            </div>

            {!collapsed && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={brandTitle}>XChange</div>
                <div style={brandSub}>Painel do consultor</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={collapseBtn}
            aria-label="Alternar sidebar"
            title="Alternar sidebar"
          >
            <ChevronIcon />
          </button>
        </div>

        <div style={divider} />

        {/* Navegação (posicionada mais para o meio) */}
        <div style={navArea}>
          {!collapsed && <div style={sectionLabel}>NAVEGAÇÃO</div>}

          <NavItem
            collapsed={collapsed}
            active={activeKey === "home"}
            label="Início"
            onClick={() => navigate("/app")}
            icon={<HomeIcon />}
          />

          <NavItem
            collapsed={collapsed}
            active={activeKey === "projects"}
            label="Status e Prospecção"
            onClick={() => navigate("/projects/status")}
            icon={<ChartIcon />}
          />

          <NavItem
            collapsed={collapsed}
            active={activeKey === "tasks"}
            label="Tarefas"
            onClick={() => navigate("/tasks/manage")}
            icon={<CheckIcon />}
          />

          <div style={{ height: 18 }} />

          {!collapsed && (
            <>
              <div style={sectionLabel}>MÓDULOS FUTUROS</div>
              <div style={futureList}>
                <div style={futureItem}>• Agenda & Outlook</div>
                <div style={futureItem}>• Dashboards & Uploads</div>
                <div style={futureItem}>• Indicadores</div>
              </div>
            </>
          )}
        </div>

        <div style={{ ...divider, marginTop: "auto" }} />

        {/* Rodapé */}
        <div style={footerArea}>
          {!collapsed && (
            <div style={userCard}>
              <div style={userLabel}>USUÁRIO</div>
              <div style={userEmailText}>{userEmail || "—"}</div>
            </div>
          )}

          <button type="button" style={logoutBtn} onClick={handleLogout}>
            {!collapsed ? "Sair" : <ExitIcon />}
          </button>
        </div>
      </aside>

      <main style={mainContent}>{children}</main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...navItem,
        ...(active ? navItemActive : null),
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "12px" : "12px 14px",
      }}
      title={collapsed ? label : undefined}
      aria-label={label}
    >
      <span style={navIconWrap}>{icon}</span>
      {!collapsed && <span style={navLabel}>{label}</span>}
      {!collapsed && active && <span style={activeDot} />}
    </button>
  );
}

/* =======================
   ÍCONES (monocromáticos)
   ======================= */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 19H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 15v-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 15V9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 15V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 17l-1 0a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4h1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15 7l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =======================
   ESTILOS
   ======================= */

const layoutWrapper = {
  display: "flex",
  minHeight: "100vh",
  backgroundColor: "#000000",
  color: "#e5e7eb",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const sidebar = {
  backgroundColor: "#000000",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  padding: "14px 14px 16px",
};

const topBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const brandRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const logoBox = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const brandLogo = {
  width: 30,
  height: 30,
  objectFit: "contain",
  filter: "grayscale(100%) brightness(1.15)",
  opacity: 0.95,
};

const brandTitle = {
  fontSize: "0.95rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const brandSub = {
  fontSize: "0.78rem",
  color: "rgba(229,231,235,0.65)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const collapseBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  color: "rgba(229,231,235,0.9)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const divider = {
  height: 1,
  background: "rgba(255,255,255,0.08)",
  marginTop: 14,
};

const navArea = {
  paddingTop: 18,
  paddingBottom: 18,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  // “mais pro meio”: empurra um pouco pra baixo sem colar no topo
  marginTop: 22,
};

const sectionLabel = {
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  color: "rgba(229,231,235,0.50)",
  padding: "0 6px",
  marginBottom: 6,
};

const navItem = {
  width: "100%",
  border: "none", // sem contorno de botão
  background: "transparent",
  color: "rgba(229,231,235,0.92)",
  cursor: "pointer",
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  gap: 10,
  transition: "transform 120ms ease, background 160ms ease",
  textAlign: "left",
};

const navItemActive = {
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
};

const navIconWrap = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(229,231,235,0.85)", // ícone prata
  flex: "0 0 auto",
};

const navLabel = {
  fontSize: "0.92rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  flex: 1,
  minWidth: 0,
};

const activeDot = {
  width: 6,
  height: 6,
  borderRadius: 999,
  backgroundColor: "rgba(229,231,235,0.85)",
  marginRight: 8,
};

const futureList = {
  padding: "2px 6px 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const futureItem = {
  fontSize: "0.84rem",
  color: "rgba(229,231,235,0.55)",
};

const footerArea = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  paddingTop: 16,
};

const userCard = {
  borderRadius: 16,
  padding: "12px 12px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
};

const userLabel = {
  fontSize: "0.70rem",
  letterSpacing: "0.14em",
  color: "rgba(229,231,235,0.55)",
  marginBottom: 8,
};

const userEmailText = {
  fontSize: "0.86rem",
  color: "rgba(229,231,235,0.92)",
  wordBreak: "break-word",
  lineHeight: 1.2,
};

const logoutBtn = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  color: "rgba(229,231,235,0.92)",
  fontSize: "0.92rem",
  fontWeight: 700,
  cursor: "pointer",
};

const mainContent = {
  flex: 1,
  padding: "1.5rem 2rem",
  overflowY: "auto",
  backgroundColor: "#000000", // garante preto no conteúdo
};

export default SidebarLayout;
