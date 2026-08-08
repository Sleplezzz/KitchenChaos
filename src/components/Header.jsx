import React from "react";
import { Flame, Radio, Users, Settings, X } from "lucide-react";

export default function Header({ viewers, adminOpen, setAdminOpen }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Flame color="var(--flame)" size={24} />
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 1,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Kitchen Chaos
        </h1>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "var(--service)",
            marginLeft: 6,
            fontWeight: 600,
          }}
        >
          <Radio size={12} style={{ animation: "pulseDot 1.4s infinite" }} /> EN VIVO
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 12, color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 5 }}>
          <Users size={13} /> {viewers} viendo
        </span>
        <button
          onClick={() => setAdminOpen((o) => !o)}
          style={{
            background: adminOpen ? "var(--surface-3)" : "var(--surface-2)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 6,
            padding: 8,
            color: "var(--ink)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          aria-label="Panel de administrador"
        >
          {adminOpen ? <X size={16} /> : <Settings size={16} />}
        </button>
      </div>
    </header>
  );
}
