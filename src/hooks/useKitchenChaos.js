import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useChannel } from "@portalsdk/react";
import { STAGES } from "../constants/kitchen.js";
import { uid, randomOrderItems, itemNames, getNextSerial } from "../utils/helpers.js";
import { getAgentThought } from "../services/api.js";
import { KITCHEN_CHANNEL_ID } from "../lib/portal.js";
import { reduceKitchenMessages } from "../lib/kitchenReducer.js";

export function useKitchenChaos() {
  const { messages, send, presence, me, status } = useChannel({
    channelId: KITCHEN_CHANNEL_ID,
    history: 300, // suficiente para reconstruir toda una sesión de demo
  });

  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(new Set());

  // --- estado derivado (event sourcing sobre los mensajes del canal) ---
  const { orders, agents, chaosLog } = useMemo(() => reduceKitchenMessages(messages), [messages]);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // --- reloj local solo para mostrar "Xs" en cada ticket (no necesita sincronizarse) ---
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // --- elección de líder: solo UNA pestaña conduce el loop de la cocina.
  // Si cada pestaña abierta corriera su propio timer, tendrías pedidos
  // avanzando el doble de rápido y llamadas duplicadas a la IA. La
  // pestaña "líder" es, de forma determinista para todos, la que tiene
  // el id de sesión más chico entre los participantes conectados ahora. ---
  const isLeader = useMemo(() => {
    if (!me || !presence) return false;
    if (presence.kind === "detailed") {
      const ids = presence.participants.map((p) => p.id).sort();
      return ids[0] === me.id;
    }
    // Canales grandes (aggregate) no traen roster completo — en un
    // hackathon esto no debería pasar, pero por seguridad no forzamos
    // el loop en más de un lado a la vez.
    return false;
  }, [me, presence]);

  const viewers =
    presence?.kind === "detailed"
      ? presence.count
      : presence?.kind === "aggregate"
      ? presence.count
      : 1;

  const pushChaosLog = useCallback(
    (text, who) => send({ content: { kind: "chaos_log", text, who } }),
    [send]
  );

  const setAgentStatus = useCallback(
    (role, thought, status) => send({ content: { kind: "agent_status", role, thought, status } }),
    [send]
  );

  const addOrder = useCallback(
    (items, isBackground, customerName) => {
      const serial = getNextSerial();
      const order = {
        id: uid(),
        short: String(serial).padStart(3, "0"),
        items,
        customerName: customerName || "",
        createdAt: Date.now(),
        tilt: (Math.random() * 3 - 1.5).toFixed(1),
        background: !!isBackground,
      };
      send({ content: { kind: "order_created", order } });
      return order.id;
    },
    [send]
  );

  const advanceOrder = useCallback(
    async (orderId) => {
      if (busyRef.current.has(orderId)) return;
      busyRef.current.add(orderId);

      const ord = ordersRef.current.find((o) => o.id === orderId);
      if (!ord || ord.stage === "delivered") {
        busyRef.current.delete(orderId);
        return;
      }
      const idx = STAGES.findIndex((s) => s.key === ord.stage);
      const nextStage = STAGES[idx + 1];
      if (!nextStage) {
        busyRef.current.delete(orderId);
        return;
      }

      const role = nextStage.agent;

      let thought = "";
      if (role) {
        thought = await getAgentThought(
          role,
          `El pedido #${ord.short} (${itemNames(ord.items)}) pasa a la etapa "${nextStage.label}".`
        );
        await setAgentStatus(role, thought, "ok");
        await pushChaosLog(thought, role);
      }

      await send({
        content: {
          kind: "stage_advanced",
          orderId,
          stage: nextStage.key,
          thought,
          activeAgent: role,
          deliveredAt: nextStage.key === "delivered" ? Date.now() : undefined,
        },
      });

      busyRef.current.delete(orderId);
    },
    [send, setAgentStatus, pushChaosLog]
  );

  // --- loop principal: solo corre en la pestaña líder ---
  useEffect(() => {
    if (!isLeader) return;
    const t = setInterval(() => {
      const active = ordersRef.current.filter((o) => o.stage !== "delivered");
      if (active.length) {
        const candidate = active[Math.floor(Math.random() * active.length)];
        advanceOrder(candidate.id);
      }
    }, 2800);
    return () => clearInterval(t);
  }, [isLeader, advanceOrder]);

  // --- pedidos de fondo ("walk-ins"): también solo en la pestaña líder ---
  useEffect(() => {
    if (!isLeader) return;
    const t = setInterval(() => {
      if (Math.random() > 0.45) addOrder(randomOrderItems(), true);
    }, 6000);
    return () => clearInterval(t);
  }, [isLeader, addOrder]);

  const [selected, setSelected] = useState([]);
  const [myOrderId, setMyOrderId] = useState(null);

  const submitOrder = (customerName) => {
    if (!selected.length) return;
    const id = addOrder(selected, false, customerName);
    setMyOrderId(id);
    setSelected([]);
  };

  const toggleItem = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  // --- eventos caos: los dispara quien haga clic; el resultado se publica
  // al canal y todas las pestañas lo ven igual, sin necesitar ser líder ---
  const triggerShortage = async () => {
    await pushChaosLog("Escasez de ingredientes: inventario crítico reducido.");
    const activeOrders = ordersRef.current.filter((o) => o.stage !== "delivered").slice(0, 2);
    if (activeOrders.length) {
      await send({ content: { kind: "chaos_mark", orderIds: activeOrders.map((o) => o.id) } });
    }
    const thought = await getAgentThought(
      "chef",
      "Se acaba de terminar un ingrediente clave y hay que improvisar sin detener la cocina."
    );
    await setAgentStatus("chef", thought, "ok");
    await pushChaosLog(thought, "chef");
  };

  const triggerRush = async () => {
    await pushChaosLog("Pico de demanda: 3 pedidos urgentes inyectados.");
    for (let i = 0; i < 3; i++) addOrder(randomOrderItems(), true);
    const activeOrders = ordersRef.current.filter((o) => o.stage !== "delivered");
    if (activeOrders.length) {
      await send({ content: { kind: "chaos_mark", orderIds: activeOrders.map((o) => o.id) } });
    }
    const thought = await getAgentThought(
      "gerente",
      "Llegó una ola grande de pedidos al mismo tiempo y hay que reorganizar las prioridades."
    );
    await setAgentStatus("gerente", thought, "ok");
    await pushChaosLog(thought, "gerente");
  };

  const activeCount = orders.filter((o) => o.stage !== "delivered").length;
  const deliveredOrders = orders.filter((o) => o.stage === "delivered");
  const chaosCount = orders.filter((o) => o.chaosAffected).length;
  const avgTime = deliveredOrders.length
    ? Math.round(
        deliveredOrders.reduce((sum, o) => sum + (o.deliveredAt - o.createdAt), 0) /
          deliveredOrders.length /
          1000
      )
    : 0;

  return {
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
    deliveredCount: deliveredOrders.length,
    chaosCount,
    avgTime,
    // expuestos por si quieres mostrar un indicador de conexión en el header
    portalStatus: status,
    isLeader,
  };
}
