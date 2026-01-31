// src/components/TopBar.jsx
import React from "react";

export default function TopBar({
  title = "XChange",
  onToggleMenu,
  rightSlot = null,
}) {
  return (
    <div style={wrap}>
      <div style={left}>
        <button type="button" onClick={onToggleMenu} style={iconBtn} aria-label="Abrir menu">
          {/* ícone hamburguer */}
          <span style={hambLine} />
          <span style={{ ...hambLine, width: 16, opacity: 0.9 }} />
          <span style={{ ...hambLine, width: 12, opacity: 0.8 }} />
        </button>

        <div style={brand}>
          <div style={logoBox}>
            <span style={logoText}>x</span>
          </div>
          <div style={brandText}>{title}</div>
        </div>
      </div>

      <div style={right}>
        {rightSlot}
      </div>
    </div>
  );
}

const wrap = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  height: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 14px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45))",
  backdropFilter: "blur(10px)",
};

const left = { display: "flex", alignItems: "center", gap: 10 };

const right = { display: "flex", alignItems: "center", gap: 10 };

const iconBtn = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
};

const hambLine = {
  display: "block",
  width: 18,
  height: 2,
  borderRadius: 999,
  background: "rgba(229,231,235,0.92)",
};

const brand = { display: "flex", alignItems: "center", gap: 10 };

const logoBox = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logoText = {
  fontWeight: 900,
  color: "rgba(245, 198, 63, 0.95)",
  fontSize: 16,
};

const brandText = {
  fontWeight: 900,
  letterSpacing: "0.02em",
  color: "rgba(229,231,235,0.95)",
};
