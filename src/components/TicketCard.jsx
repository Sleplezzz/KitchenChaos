import React from "react";
import { AGENT_META } from "../constants/kitchen.js";
import { itemNames } from "../utils/helpers.js";

export default function TicketCard({ order, elapsed }) {
  const agent = order.activeAgent ? AGENT_META[order.activeAgent] : null;

  return (
    <div className={`order-card${order.chaosAffected ? " chaos-affected" : ""}`}>
      <div className="order-card-top">
        <span className="order-id">#{order.short}</span>
        <time>{elapsed}s</time>
      </div>
      <h4>{order.customerName || "Pedido sin nombre"}</h4>
      <p>{itemNames(order.items)}</p>
      <div className="order-card-footer">
        <span className={`tag${order.chaosAffected ? " chaos" : ""}`}>
          {order.chaosAffected ? "⚠ CAOS" : "EN COLA"}
        </span>
        {agent && <span className="card-agent">{agent.label}</span>}
      </div>
    </div>
  );
}
