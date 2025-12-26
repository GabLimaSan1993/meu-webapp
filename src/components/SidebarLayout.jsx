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
    let ignore = false;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (ignore) return;
      setUserEmail(data?.user?.email || "");
    }

    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const activeKey = useMemo(() => {
    const p = location.pathname || "";
    if (p === "/app") return "home";
    if (p.startsWith("/projects")) return "projects";
    if (p.startsWith("/tasks")) return "tasks";
    if (p.startsWith("/uploads")) return "uploads";
    return "";
  }, [location.pathname]);

  return (
    <div style={layoutWrapper}>
      <aside style={{ ...sidebar, width: collapsed ? 86 : 224 }}>
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
            onClick={() => setCollapsed(v => !v)}
            style={collapseBtn}
            aria-label="Alternar sidebar"
          >
            <ChevronIcon rotated={collapsed} />
          </button>
        </div>

        <div style={divider} />

        {/* Navegação */}
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

          <NavItem
            collapsed={collapsed}
            active={activeKey === "uploads"}
            label="Uploads"
            onClick={() => navigate("/uploads")}
            icon={<UploadIcon />}
          />
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

/* =======================
   COMPONENTES AUXILIARES
   ======================= */

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
    >
      <span style={navIconWrap}>{icon}</span>
      {!collapsed && <span style={navLabel}>{label}</span>}
      {!collapsed && active && <span style={activeDot} />}
    </button>
  );
}

/* =======================
   ÍCONES
   ======================= */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5M4 19H20M8 15v-3M12 15V9M16 15V7"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5"
        stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M10 17l-1 0a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4h1"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 7l5 5-5 5"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12H10"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ rotated }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      style={{ transform: rotated ? "rotate(180deg)" : "rotate(0deg)", transition: "160ms" }}>
      <path d="M10 6l6 6-6 6"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =======================
   ESTILOS (inalterados)
   ======================= */

const layoutWrapper = {
  display: "flex",
  minHeight: "100vh",
  backgroundColor: "#000",
  color: "#e5e7eb",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const sidebar = {
  backgroundColor: "#000",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  padding: "14px 12px 16px",
};

const topBar = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const brandRow = { display: "flex", alignItems: "center", gap: 10 };
const logoBox = { width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" };
const brandLogo = { width: 28, filter: "grayscale(100%) brightness(1.15)" };
const brandTitle = { fontWeight: 750 };
const brandSub = { fontSize: "0.78rem", color: "rgba(229,231,235,0.6)" };
const collapseBtn = { width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" };
const divider = { height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" };
const navArea = { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 };
const sectionLabel = { fontSize: "0.7rem", letterSpacing: "0.16em", color: "rgba(229,231,235,0.45)" };
const navItem = { border: "none", background: "transparent", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" };
const navItemActive = { background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))" };
const navIconWrap = { width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" };
const navLabel = { fontSize: "0.92rem", fontWeight: 650 };
const activeDot = { width: 6, height: 6, borderRadius: 999, background: "#e5e7eb" };
const footerArea = { display: "flex", flexDirection: "column", gap: 12 };
const userCard = { borderRadius: 16, padding: 12, background: "rgba(255,255,255,0.04)" };
const userLabel = { fontSize: "0.7rem", letterSpacing: "0.14em", color: "rgba(229,231,235,0.5)" };
const userEmailText = { fontSize: "0.86rem" };
const logoutBtn = { padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" };
const mainContent = { flex: 1, padding: "1.5rem 2rem", backgroundColor: "#000" };

export default SidebarLayout;
