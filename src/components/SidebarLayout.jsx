// src/components/SidebarLayout.jsx
import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import TopBar from "./TopBar";
import { supabase } from "../lib/supabaseClient";

export default function SidebarLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dashOpen, setDashOpen] = useState(true); // dropdown dashboards
  const nav = useNavigate();
  const location = useLocation();

  const navItems = useMemo(
    () => [
      { label: "Início", to: "/app" },
      { label: "Status e Prospecção", to: "/projects/status" },
      { label: "Tarefas", to: "/tasks/manage" },
      { label: "Uploads", to: "/uploads" },
    ],
    []
  );

  const dashboardItems = useMemo(
    () => [
      { label: "Faturamento", to: "/dashboards/faturamento" },
      { label: "Contas a Pagar", to: "/dashboards/contas-pagar" },
      { label: "Contas a Receber", to: "/dashboards/contas-receber" },
      { label: "Disponibilidade x MP", to: "/dashboards/disponibilidade-mp" }, // ✅ novo
    ],
    []
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    nav("/login");
  }

  const routePill = useMemo(() => {
    const p = location.pathname || "/";
    return p.length > 42 ? `${p.slice(0, 42)}…` : p;
  }, [location.pathname]);

  const isDashActive = useMemo(() => {
    const p = location.pathname || "";
    return p.startsWith("/dashboards/");
  }, [location.pathname]);

  return (
    <div style={shell}>
      <TopBar
        title="XChange"
        onToggleMenu={() => setMenuOpen(true)}
        rightSlot={<div style={pill}>{routePill}</div>}
      />

      {/* Drawer */}
      {menuOpen ? (
        <div style={overlay} onClick={() => setMenuOpen(false)}>
          <aside style={drawer} onClick={(e) => e.stopPropagation()}>
            <div style={drawerHeader}>
              <div style={drawerTitle}>Navegação</div>

              <button type="button" style={closeBtn} onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>

            <div style={drawerList}>
              {navItems.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={() => setMenuOpen(false)}
                  style={({ isActive }) => ({
                    ...drawerItem,
                    ...(isActive ? drawerItemActive : null),
                  })}
                >
                  {it.label}
                </NavLink>
              ))}

              {/* ✅ Dashboards (dropdown) */}
              <button
                type="button"
                onClick={() => setDashOpen((v) => !v)}
                style={{
                  ...drawerItem,
                  ...(isDashActive ? drawerItemActive : null),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Dashboards</span>
                <span style={{ opacity: 0.85, fontWeight: 900 }}>{dashOpen ? "▾" : "▸"}</span>
              </button>

              {dashOpen ? (
                <div style={dashSubList}>
                  {dashboardItems.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      onClick={() => setMenuOpen(false)}
                      style={({ isActive }) => ({
                        ...dashSubItem,
                        ...(isActive ? dashSubItemActive : null),
                      })}
                    >
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={drawerFooter}>
              <button type="button" style={logoutBtn} onClick={handleLogout}>
                Sair
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main style={content}>{children}</main>
    </div>
  );
}

/* ===== styles (mantém os seus) ===== */
const shell = { minHeight: "100vh", background: "#000" };
const content = { padding: "14px 14px 26px" };

const pill = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.85)",
  fontWeight: 800,
  fontSize: 12,
  maxWidth: 360,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(6px)",
  display: "flex",
};

const drawer = {
  width: 320,
  maxWidth: "86vw",
  height: "100%",
  borderRight: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.92))",
  boxShadow: "0 24px 90px rgba(0,0,0,0.75)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
};

const drawerHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 6px 14px",
};

const drawerTitle = {
  color: "rgba(229,231,235,0.95)",
  fontSize: 16,
  fontWeight: 900,
};

const closeBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.85)",
  cursor: "pointer",
};

const drawerList = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 6,
};

const drawerItem = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  color: "rgba(229,231,235,0.90)",
  cursor: "pointer",
  fontWeight: 850,
  textDecoration: "none",
  textAlign: "left",
};

const drawerItemActive = {
  border: "1px solid rgba(245,198,63,0.45)",
  background: "linear-gradient(135deg, rgba(245,198,63,0.16), rgba(0,0,0,0.45))",
  boxShadow: "0 14px 35px rgba(245,198,63,0.08)",
};

const dashSubList = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  paddingLeft: 10,
  marginTop: 2,
};

const dashSubItem = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.22)",
  color: "rgba(229,231,235,0.88)",
  cursor: "pointer",
  fontWeight: 820,
  textDecoration: "none",
};

const dashSubItemActive = {
  border: "1px solid rgba(245,198,63,0.38)",
  background: "linear-gradient(135deg, rgba(245,198,63,0.12), rgba(0,0,0,0.40))",
  boxShadow: "0 12px 28px rgba(245,198,63,0.06)",
};

const drawerFooter = { marginTop: "auto", padding: 6 };

const logoutBtn = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(127,29,29,0.25)",
  color: "rgba(254,202,202,0.95)",
  fontWeight: 900,
  cursor: "pointer",
};
