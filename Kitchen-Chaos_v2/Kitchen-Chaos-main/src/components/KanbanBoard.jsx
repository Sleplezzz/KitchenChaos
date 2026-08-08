import React from "react";
import { Bell } from "lucide-react";
import { STAGES } from "../constants/kitchen.js";
import TicketCard from "./TicketCard.jsx";

export default function KanbanBoard({ orders, now }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {STAGES.map((stage) => {
        const stageOrders = orders.filter((o) => o.stage === stage.key);
        const items = stageOrders.slice(0, 8);
        return (
          <div key={stage.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Bell size={13} color="var(--ink-dim)" />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  letterSpacing: 1,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                }}
              >
                {stage.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-dim)" }}>({stageOrders.length})</span>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, minHeight: 90 }}>
              {items.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-dim)", padding: "10px 0" }}>
                  — sin pedidos —
                </div>
              )}
              {items.map((o) => (
                <TicketCard
                  key={o.id}
                  order={o}
                  elapsed={Math.max(0, Math.round((now - o.createdAt) / 1000))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
