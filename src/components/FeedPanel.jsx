import React from "react";

export default function FeedPanel({ chaosLog }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {chaosLog.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>Sin eventos todavía.</div>
      )}
      {chaosLog.map((c) => (
        <div
          key={c.id}
          style={{
            background: "var(--surface-2)",
            borderRadius: 5,
            padding: "6px 8px",
            fontSize: 11,
            color: "var(--ink)",
            animation: "printIn 0.25s ease-out",
          }}
        >
          {c.text}
        </div>
      ))}
    </div>
  );
}
