import React from "react";
import Header from "./components/Header.jsx";
import AdminDrawer from "./components/AdminDrawer.jsx";
import MetricsBar from "./components/MetricsBar.jsx";
import OrderForm from "./components/OrderForm.jsx";
import KanbanBoard from "./components/KanbanBoard.jsx";
import AgentPanel from "./components/AgentPanel.jsx";
import FeedPanel from "./components/FeedPanel.jsx";
import { useKitchenChaos } from "./hooks/useKitchenChaos.js";

export default function App() {
  const {
    orders,
    agents,
    chaosLog,
    selected,
    adminOpen,
    setAdminOpen,
    viewers,
    now,
    toggleItem,
    submitOrder,
    triggerShortage,
    triggerRush,
    triggerAgentFailure,
    activeCount,
    deliveredCount,
    chaosCount,
    avgTime,
  } = useKitchenChaos();

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <Header viewers={viewers} adminOpen={adminOpen} setAdminOpen={setAdminOpen} />

      {adminOpen && (
        <AdminDrawer
          triggerShortage={triggerShortage}
          triggerRush={triggerRush}
          triggerAgentFailure={triggerAgentFailure}
        />
      )}

      <div className="main-grid">
        {/* Main Content Area */}
        <div>
          <MetricsBar
            activeCount={activeCount}
            deliveredCount={deliveredCount}
            chaosCount={chaosCount}
            avgTime={avgTime}
          />

          <OrderForm selected={selected} toggleItem={toggleItem} submitOrder={submitOrder} />

          <KanbanBoard orders={orders} now={now} />
        </div>

        {/* Sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                letterSpacing: 1,
                color: "var(--ink-dim)",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Agentes
            </div>
            <AgentPanel agents={agents} />
          </div>

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                letterSpacing: 1,
                color: "var(--ink-dim)",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Feed de eventos
            </div>
            <FeedPanel chaosLog={chaosLog} />
          </div>
        </aside>
      </div>
    </div>
  );
}
