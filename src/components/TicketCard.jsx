import React from "react";
import { AGENT_META } from "../constants/kitchen.js";
import { itemNames } from "../utils/helpers.js";

export default function TicketCard({ order, elapsed }) {
  const meta = order.activeAgent ? AGENT_META[order.activeAgent] : null;

  return (
    <div
      style={{
        background: "var(--ticket)",
        color: "#20241f",
        borderRadius: 3,
        padding: "12px 12px 14px",
        width: 190,
        flexShrink: 0,
        boxShadow: order.chaosAffected
          ? "0 0 0 2px var(--alert), 0 6px 14px rgba(0,0,0,0.35)"
          : "0 6px 14px rgba(0,0,0,0.35)",
        transform: `rotate(${order.tilt}deg)`,
        fontFamily: "var(--font-mono)",
        position: "relative",
        animation: "printIn 0.4s ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
        <span>#{order.short}</span>
        <span>{elapsed}s</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.35, fontWeight: 600, minHeight: 32 }}>
        {itemNames(order.items)}
      </div>
      {order.chaosAffected && (
        <div style={{ fontSize: 9, color: "#7a1f14", marginTop: 4, fontWeight: 700, letterSpacing: 0.4 }}>
          ⚠ AFECTADO POR CAOS
        </div>
      )}
      <div style={{ borderTop: "1px dashed #b9b39c", margin: "8px 0 6px" }} />
      {order.thought && meta && (
        <div
          style={{
            background: order.activeAgent === "respaldo" ? "#ffe2dc" : "#fff6cf",
            border: `1px solid ${order.activeAgent === "respaldo" ? "#e5a898" : "#e0d38f"}`,
            borderRadius: 2,
            padding: "5px 6px",
            fontSize: 10,
            lineHeight: 1.3,
            transform: "rotate(-1.5deg)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <strong style={{ color: meta.color, fontWeight: 700 }}>{meta.label}:</strong> {order.thought}
        </div>
      )}
    </div>
  );
}
