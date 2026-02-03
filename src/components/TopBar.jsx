// src/components/TopBar.jsx
import React from "react";
import { MoreVertical } from "lucide-react";

export default function TopBar({
  title = "XChange",
  onToggleMenu,
  rightSlot = null,
}) {
  return (
    <div style={wrap}>
      <div style={left}>
        <button
          type="button"
          onClick={onToggleMenu}
          style={iconBtn}
          aria-label="Abrir menu"
          title="Menu"
        >
          <MoreVertical size={20} />
        </button>

        <div style={brand}>
          <div style={brandText}>{title}</div>
        </div>
      </div>

      <div style={right}>{rightSlot}</div>
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
  display: "grid",
  placeItems: "center",
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
  color: "rgba(229,231,235,0.92)",
};

const brand = { display: "flex", alignItems: "center", gap: 10 };

const brandText = {
  fontWeight: 900,
  letterSpacing: "0.02em",
  color: "rgba(229,231,235,0.95)",
  fontSize: 18,
};
