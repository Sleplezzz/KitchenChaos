import React from "react";
import { MENU } from "../constants/kitchen.js";

export default function OrderForm({ selected, toggleItem, submitOrder }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, padding: 14, marginBottom: 18 }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          letterSpacing: 0.5,
          marginBottom: 10,
          fontWeight: 600,
        }}
      >
        HACER UN PEDIDO
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {MENU.map((m) => {
          const isSelected = selected.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggleItem(m.id)}
              style={{
                background: isSelected ? "var(--flame)" : "var(--surface-2)",
                color: isSelected ? "#1a1a1a" : "var(--ink)",
                border: "none",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontWeight: isSelected ? 700 : 400,
                transition: "all 0.15s ease",
              }}
            >
              {m.emoji} {m.name}
            </button>
          );
        })}
      </div>
      <button
        onClick={submitOrder}
        disabled={!selected.length}
        style={{
          background: selected.length ? "var(--service)" : "var(--surface-2)",
          color: selected.length ? "#0e1a17" : "var(--ink-dim)",
          border: "none",
          borderRadius: 6,
          padding: "9px 16px",
          fontWeight: 700,
          fontSize: 12,
          cursor: selected.length ? "pointer" : "not-allowed",
          fontFamily: "var(--font-mono)",
          transition: "all 0.15s ease",
        }}
      >
        Enviar pedido →
      </button>
    </div>
  );
}
