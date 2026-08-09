import React from "react";
import { STAGES } from "../constants/kitchen.js";
import TicketCard from "./TicketCard.jsx";

export default function KanbanBoard({ orders, now }) {
  return (
    <div className="kanban" aria-live="polite">
      {STAGES.map((stage, i) => {
        const stageOrders = orders.filter((o) => o.stage === stage.key);
        return (
          <section key={stage.key} className={`kanban-column ${stage.key}`}>
            <header>
              <span className="column-index">{String(i + 1).padStart(2, "0")}</span>
              <h3>{stage.label}</h3>
              <b>{stageOrders.length}</b>
            </header>
            <div className="order-list" data-stage={stage.key}>
              {stageOrders.map((o) => (
                <TicketCard key={o.id} order={o} elapsed={Math.max(0, Math.round((now - o.createdAt) / 1000))} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
