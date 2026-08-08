import React from "react";
import { Clock, CheckCircle2, AlertTriangle, Package } from "lucide-react";
import { MetricCard } from "./MetricCard.jsx";

export default function MetricsBar({ activeCount, deliveredCount, chaosCount, avgTime }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      <MetricCard label="Activos" value={activeCount} icon={Clock} color="var(--brass)" />
      <MetricCard label="Entregados" value={deliveredCount} icon={CheckCircle2} color="var(--service)" />
      <MetricCard label="Afectados por caos" value={chaosCount} icon={AlertTriangle} color="var(--alert)" />
      <MetricCard label="Tiempo prom." value={`${avgTime}s`} icon={Package} color="var(--flame)" />
    </div>
  );
}
