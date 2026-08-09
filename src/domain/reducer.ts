import { kitchenEventSchema, type KitchenEventContent } from "./events";
import {
  createEmptyProjection,
  type AgentActivity,
  type AgentRole,
  type KitchenProjection,
  type Order,
  type PortalMessageLike,
} from "./projection";

function isAgentEvent(
  event: KitchenEventContent,
): event is KitchenEventContent & {
  actionKey: string;
  thought: string;
  agentRole: AgentRole;
} {
  return (
    event.type === "order.assigned" ||
    event.type === "order.reassigned" ||
    event.type === "order.delivered"
  );
}

function withAccepted(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: KitchenEventContent,
  patch: {
    orders?: Record<string, Order>;
    stations?: KitchenProjection["stations"];
  },
): KitchenProjection {
  const appliedMessageIds = {
    ...state.appliedMessageIds,
    [message.id]: true as const,
  };

  let appliedActionKeys = state.appliedActionKeys;
  let agents = state.agents;

  if (isAgentEvent(event)) {
    appliedActionKeys = {
      ...state.appliedActionKeys,
      [event.actionKey]: true as const,
    };
    const activity: AgentActivity = {
      thought: event.thought,
      lastActionKey: event.actionKey,
      updatedSeq: message.seq,
    };
    agents = {
      ...state.agents,
      [event.agentRole]: activity,
    };
  }

  return {
    ...state,
    orders: patch.orders ?? state.orders,
    stations: patch.stations ?? state.stations,
    agents,
    appliedMessageIds,
    appliedActionKeys,
  };
}

function reduceOrderCreated(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "order.created" }>,
): KitchenProjection {
  const { orderId } = event.payload;
  if (state.orders[orderId]) {
    return state;
  }

  const order: Order = {
    id: orderId,
    customerId: event.payload.customerId,
    customerName: event.payload.customerName,
    items: event.payload.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    })),
    stage: "received",
    station: null,
    priorityScore: null,
    createdSeq: message.seq,
    updatedSeq: message.seq,
  };

  return withAccepted(state, message, event, {
    orders: { ...state.orders, [orderId]: order },
  });
}

function reduceOrderAssigned(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "order.assigned" }>,
): KitchenProjection {
  const { orderId, station, priorityScore } = event.payload;
  const existing = state.orders[orderId];
  if (!existing || existing.stage !== "received") {
    return state;
  }
  if (state.stations[station] === "failed") {
    return state;
  }

  const order: Order = {
    ...existing,
    stage: "cooking",
    station,
    priorityScore,
    updatedSeq: message.seq,
  };

  return withAccepted(state, message, event, {
    orders: { ...state.orders, [orderId]: order },
  });
}

function reduceOrderReassigned(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "order.reassigned" }>,
): KitchenProjection {
  const { orderId, station, priorityScore } = event.payload;
  const existing = state.orders[orderId];
  if (!existing || existing.stage === "delivered") {
    return state;
  }
  if (state.stations[station] === "failed") {
    return state;
  }

  const order: Order = {
    ...existing,
    station,
    priorityScore,
    updatedSeq: message.seq,
  };

  return withAccepted(state, message, event, {
    orders: { ...state.orders, [orderId]: order },
  });
}

function reduceOrderReady(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "order.ready" }>,
): KitchenProjection {
  const { orderId } = event.payload;
  const existing = state.orders[orderId];
  if (!existing || existing.stage !== "cooking") {
    return state;
  }

  const order: Order = {
    ...existing,
    stage: "ready",
    updatedSeq: message.seq,
  };

  return withAccepted(state, message, event, {
    orders: { ...state.orders, [orderId]: order },
  });
}

function reduceOrderDelivered(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "order.delivered" }>,
): KitchenProjection {
  const { orderId } = event.payload;
  const existing = state.orders[orderId];
  if (!existing || existing.stage !== "ready") {
    return state;
  }

  const order: Order = {
    ...existing,
    stage: "delivered",
    updatedSeq: message.seq,
  };

  return withAccepted(state, message, event, {
    orders: { ...state.orders, [orderId]: order },
  });
}

function reduceStationFailed(
  state: KitchenProjection,
  message: PortalMessageLike,
  event: Extract<KitchenEventContent, { type: "station.failed" }>,
): KitchenProjection {
  return withAccepted(state, message, event, {
    stations: {
      ...state.stations,
      [event.payload.station]: "failed",
    },
  });
}

/**
 * Pure fold of one Portal message into a kitchen projection.
 * Invalid, retracted, duplicate, or stage-illegal messages leave state unchanged.
 */
export function reduceKitchen(
  state: KitchenProjection,
  message: PortalMessageLike,
): KitchenProjection {
  if (message.retracted) {
    return state;
  }

  if (state.appliedMessageIds[message.id]) {
    return state;
  }

  const parsed = kitchenEventSchema.safeParse(message.content);
  if (!parsed.success) {
    return state;
  }

  const event = parsed.data;

  if (isAgentEvent(event) && state.appliedActionKeys[event.actionKey]) {
    return state;
  }

  switch (event.type) {
    case "order.created":
      return reduceOrderCreated(state, message, event);
    case "order.assigned":
      return reduceOrderAssigned(state, message, event);
    case "order.reassigned":
      return reduceOrderReassigned(state, message, event);
    case "order.ready":
      return reduceOrderReady(state, message, event);
    case "order.delivered":
      return reduceOrderDelivered(state, message, event);
    case "station.failed":
      return reduceStationFailed(state, message, event);
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/**
 * Replay Portal history into a projection. Messages are sorted by ascending `seq`.
 */
export function projectKitchen(
  roomId: string,
  messages: readonly PortalMessageLike[],
): KitchenProjection {
  const sorted = [...messages].sort((a, b) => a.seq - b.seq);
  return sorted.reduce(
    (state, message) => reduceKitchen(state, message),
    createEmptyProjection(roomId),
  );
}
