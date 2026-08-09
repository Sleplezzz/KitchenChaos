import React from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import MetricStrip from "./components/MetricStrip.jsx";
import OrderForm from "./components/OrderForm.jsx";
import TrackingCard from "./components/TrackingCard.jsx";
import KanbanBoard from "./components/KanbanBoard.jsx";
import AgentRoster from "./components/AgentRoster.jsx";
import DecisionFeed from "./components/DecisionFeed.jsx";
import ChaosCard from "./components/ChaosCard.jsx";
import { useKitchenChaos } from "./hooks/useKitchenChaos.js";
import { formatClock } from "./utils/helpers.js";

export default function App() {
  const {
    orders,
    agents,
    chaosLog,
    selected,
    myOrderId,
    viewers,
    now,
    toggleItem,
    submitOrder,
    triggerShortage,
    triggerRush,
    activeCount,
    deliveredCount,
    chaosCount,
    avgTime,
  } = useKitchenChaos();

  return (
    <>
      <div className="noise" aria-hidden="true"></div>
      <Header />

      <main id="inicio">
        <Hero viewers={viewers} now={now} chaosActive={chaosCount > 0} />

        <MetricStrip
          activeCount={activeCount}
          deliveredCount={deliveredCount}
          avgTime={avgTime}
          chaosCount={chaosCount}
        />

        <section className="order-section container" id="pedir">
          <div className="section-heading">
            <p className="eyebrow">01 / PUNTO DE ENTRADA</p>
            <h2>Inicia un pedido.</h2>
            <p>La cocina te asignará un identificador y un canal de seguimiento al instante.</p>
          </div>
          <div className="order-layout">
            <OrderForm selected={selected} toggleItem={toggleItem} submitOrder={submitOrder} />
            <TrackingCard orders={orders} myOrderId={myOrderId} />
          </div>
        </section>

        <section className="board-section" id="tablero">
          <div className="container">
            <div className="section-heading board-heading">
              <div>
                <p className="eyebrow">02 / EL FLUJO COMPLETO</p>
                <h2>Tablero de la cocina.</h2>
              </div>
              <div className="board-caption">
                <span className="pulse"></span> Sincronizado por eventos
                <br />
                <small>último pulso: {formatClock(now)}</small>
              </div>
            </div>
            <KanbanBoard orders={orders} now={now} />
          </div>
        </section>

        <section className="agent-section container" id="agentes">
          <div className="section-heading agent-heading">
            <div>
              <p className="eyebrow">03 / CAPA DE DECISIÓN</p>
              <h2>Agentes con criterio operativo.</h2>
            </div>
            <p>
              Mostramos el porqué de las decisiones sin exponer razonamientos internos: solo un resumen claro,
              útil y auditable.
            </p>
          </div>
          <div className="agent-layout">
            <AgentRoster agents={agents} />
            <DecisionFeed chaosLog={chaosLog} />
            <ChaosCard triggerShortage={triggerShortage} triggerRush={triggerRush} chaosCount={chaosCount} />
          </div>
        </section>
      </main>

      <footer className="site-footer container">
        <span className="brand">
          kitchen<span>chaos</span>
        </span>
        <p>Demo autónoma para hackathon · Modo simulación local</p>
        <span>v1.0 / {formatClock(now)}</span>
      </footer>
    </>
  );
}
