import React from "react";

export default function MetricStrip({ activeCount, deliveredCount, avgTime, chaosCount }) {
  return (
    <section className="metric-strip container" aria-label="Métricas operativas">
      <div className="metric">
        <span>EN OPERACIÓN</span>
        <strong>{String(activeCount).padStart(2, "0")}</strong>
        <small>
          <i className="trend-up">↗</i> pedidos activos ahora
        </small>
      </div>
      <div className="metric">
        <span>ENTREGADOS</span>
        <strong>{String(deliveredCount).padStart(2, "0")}</strong>
        <small>
          <i className="trend-up">↗</i> en esta sesión
        </small>
      </div>
      <div className="metric">
        <span>TIEMPO PROMEDIO</span>
        <strong>
          {avgTime}
          <span>s</span>
        </strong>
        <small>
          <i className="trend-down">↓</i> de pedido a entrega
        </small>
      </div>
      <div className="metric metric-chaos">
        <span>IMPACTO CAOS</span>
        <strong>{String(chaosCount).padStart(2, "0")}</strong>
        <small>
          <i className="orange-dot"></i> pedidos replanificados
        </small>
      </div>
    </section>
  );
}
