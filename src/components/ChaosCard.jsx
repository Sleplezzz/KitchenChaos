import React from "react";

export default function ChaosCard({ triggerShortage, triggerRush, chaosCount }) {
  return (
    <aside className="chaos-card" id="chaos">
      <div className="chaos-head">
        <span className="warning-icon">!</span>
        <div>
          <p className="eyebrow">PANEL HOST</p>
          <h3>Provocar caos</h3>
        </div>
      </div>
      <p>Introduce una disrupción y observa cómo se replanifica la operación.</p>
      <button className="chaos-action" type="button" onClick={triggerShortage}>
        <span>◒</span>
        <div>
          <b>Escasez de ingredientes</b>
          <small>Reduce inventario crítico</small>
        </div>
        <i>→</i>
      </button>
      <button className="chaos-action" type="button" onClick={triggerRush}>
        <span>↯</span>
        <div>
          <b>Pico de demanda</b>
          <small>Inyecta 3 pedidos urgentes</small>
        </div>
        <i>→</i>
      </button>
      <div className="chaos-foot">
        <span className="pulse"></span>
        <b>{chaosCount > 0 ? "Replanificando operación" : "Todo bajo control"}</b>
      </div>
    </aside>
  );
}
