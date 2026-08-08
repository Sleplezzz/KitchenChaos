import React from "react";
import { chaosBtnStyle } from "../utils/helpers.js";

export default function AdminDrawer({ triggerShortage, triggerRush, triggerAgentFailure }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--alert)",
        borderRadius: 8,
        padding: 14,
        marginBottom: 18,
        animation: "printIn 0.3s ease-out",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: 0.5,
          marginBottom: 10,
          color: "var(--alert)",
          fontWeight: 700,
        }}
      >
        PANEL DEL HOST — DISPARAR EVENTOS CAOS
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={triggerShortage} style={chaosBtnStyle("var(--flame)")}>
          🔥 Falta de ingrediente
        </button>
        <button onClick={triggerRush} style={chaosBtnStyle("var(--brass)")}>
          📈 Pico de pedidos
        </button>
        <button onClick={() => triggerAgentFailure("chef")} style={chaosBtnStyle("var(--alert)")}>
          ⚠ Falla: Chef
        </button>
        <button onClick={() => triggerAgentFailure("repartidor")} style={chaosBtnStyle("var(--alert)")}>
          ⚠ Falla: Repartidor
        </button>
      </div>
    </div>
  );
}
