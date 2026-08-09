/* ------------------------------------------------------------------
   Reducer puro: toma el historial de mensajes de un canal de Portal
   (room.messages, seq-ordered) y reconstruye { orders, agents, chaosLog }.

   Por qué así: en vez de que cada pestaña mantenga su propio useState
   y se lo cuente a las demás, TODAS las pestañas derivan exactamente
   el mismo estado leyendo la misma secuencia de mensajes del canal.
   Es el patrón "event sourcing" y es lo que hace que el tablero se
   vea idéntico en el celular del jurado y en tu laptop.
-------------------------------------------------------------------*/

const DEFAULT_AGENTS = {
  chef: { status: "ok", thought: "Listo para tomar pedidos." },
  gerente: { status: "ok", thought: "Vigilando la cola." },
  repartidor: { status: "ok", thought: "En espera en la base." },
  monitor: { status: "ok", thought: "Cuida la continuidad." },
};

export function reduceKitchenMessages(messages) {
  const orders = {};
  const agents = {
    chef: { ...DEFAULT_AGENTS.chef },
    gerente: { ...DEFAULT_AGENTS.gerente },
    repartidor: { ...DEFAULT_AGENTS.repartidor },
    monitor: { ...DEFAULT_AGENTS.monitor },
  };
  const chaosLog = [];

  for (const m of messages) {
    const c = m.content;
    if (!c || !c.kind) continue;

    switch (c.kind) {
      case "order_created": {
        orders[c.order.id] = {
          ...c.order,
          stage: "received",
          thought: "",
          activeAgent: "chef",
          chaosAffected: false,
        };
        break;
      }
      case "stage_advanced": {
        const existing = orders[c.orderId];
        if (existing) {
          orders[c.orderId] = {
            ...existing,
            stage: c.stage,
            thought: c.thought,
            activeAgent: c.activeAgent,
            deliveredAt: c.deliveredAt ?? existing.deliveredAt,
          };
        }
        break;
      }
      case "chaos_mark": {
        for (const orderId of c.orderIds || []) {
          if (orders[orderId]) {
            orders[orderId] = { ...orders[orderId], chaosAffected: true };
          }
        }
        break;
      }
      case "agent_status": {
        if (agents[c.role]) {
          agents[c.role] = {
            status: c.status ?? agents[c.role].status,
            thought: c.thought ?? agents[c.role].thought,
          };
        }
        break;
      }
      case "chaos_log": {
        chaosLog.push({ id: m.id, text: c.text, who: c.who || null, ts: m.timestamp ?? Date.now() });
        break;
      }
      default:
        break;
    }
  }

  const ordersArr = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
  chaosLog.reverse();

  return { orders: ordersArr, agents, chaosLog: chaosLog.slice(0, 20) };
}
