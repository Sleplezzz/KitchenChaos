import React from "react";
import { AGENT_META } from "../constants/kitchen.js";

export default function AgentPanel({ agents }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(agents).map(([key, a]) => {
        if (key === "respaldo" && a.status === "idle") return null;
        const meta = AGENT_META[key];
        const Icon = meta.icon;
        const down = a.status === "down";

        return (
          <div
            key={key}
            style={{
              background: "var(--surface-2)",
              borderRadius: 6,
              padding: "10px 12px",
              border: `1px solid ${down ? "var(--alert)" : "rgba(255,255,255,0.06)"}`,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon size={15} color={meta.color} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: 0.5,
                  fontSize: 13,
                  color: "var(--ink)",
                }}
              >
                {meta.label.toUpperCase()}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: down ? "var(--alert)" : "var(--service)",
                  boxShadow: down ? "0 0 6px var(--alert)" : "0 0 6px var(--service)",
                }}
              />
              {down && <span style={{ fontSize: 9, color: "var(--alert)", fontWeight: 700 }}>SIN RESPUESTA</span>}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dim)", minHeight: 28 }}>
              {a.thought || "…"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
