import React from "react";

export function MetricCard({ label, value, icon: Icon, color }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--surface-2)",
        borderRadius: 6,
        border: "1px solid rgba(255, 255, 255, 0.04)",
        minWidth: 120,
      }}
    >
      <Icon size={18} color={color} />
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--ink-dim)",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
