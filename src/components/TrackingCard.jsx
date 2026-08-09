import React from "react";
import { STAGES, AGENT_META } from "../constants/kitchen.js";

export default function TrackingCard({ orders, myOrderId }) {
  const order = orders.find((o) => o.id === myOrderId);

  if (!order) {
    return (
      <aside className="tracking-card card" aria-live="polite">
        <div className="tracking-empty">
          <div className="tracking-rings" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <b>?</b>
          </div>
          <p className="eyebrow">SEGUIMIENTO PERSONAL</p>
          <h3>Tu pedido aparecerá aquí.</h3>
          <p>Cada orden recibe un código único y avanza en el mismo flujo que ve todo el público.</p>
        </div>
      </aside>
    );
  }

  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.key === order.stage));
  const fillPercent = (stageIdx / (STAGES.length - 1)) * 100;
  const agent = order.activeAgent ? AGENT_META[order.activeAgent] : AGENT_META.chef;

  return (
    <aside className="tracking-card card" aria-live="polite">
      <div className="tracking-order">
        <div className="tracking-header">
          <div>
            <p className="eyebrow">
              CANAL <span>ORDER-{order.short}</span>
            </p>
            <h3>Pedido para {order.customerName || "ti"}</h3>
          </div>
          <span className="tracking-status">{STAGES[stageIdx].label.toUpperCase()}</span>
        </div>
        <div className="route-line" aria-label="Progreso del pedido">
          <span className="route-fill" style={{ width: `${fillPercent}%` }}></span>
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              className={`route-node${i <= stageIdx ? " complete" : ""}`}
              data-node={s.key}
            ></span>
          ))}
        </div>
        <div className="route-labels">
          {STAGES.map((s) => (
            <span key={s.key}>{s.label}</span>
          ))}
        </div>
        <div className="tracking-detail">
          <div>
            <span>PREPARA</span>
            <b>{agent.label} {agent.name}</b>
          </div>
          <div>
            <span>ETAPAS RESTANTES</span>
            <b>{STAGES.length - 1 - stageIdx}</b>
          </div>
        </div>
        <div className="decision-note">
          <span className="decision-icon">✦</span>
          <p>{order.thought || "La orden ya entró a la cola priorizada de cocina."}</p>
        </div>
      </div>
    </aside>
  );
}
