import {
  buildActionKey,
  kitchenEventSchema,
  type KitchenEventContent,
} from "./events";

/** Structurally compatible with the plan PortalMessageLike contract. */
export type PortalMessageLike = {
  id: string;
  seq: number;
  timestamp: number;
  retracted: boolean;
  ephemeral: false;
  content: KitchenEventContent;
};

const DEFAULT_ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const DEFAULT_ROOM_ID = "kitchen-demo";
const DEFAULT_TRIGGER_ID = "m_42";
const DEFAULT_CUSTOMER_ID = "cust-1";
const DEFAULT_CUSTOMER_NAME = "Ada";

type OrderIdentityOverrides = {
  orderId?: string;
  roomId?: string;
};

type AgentOrderOverrides = OrderIdentityOverrides & {
  causedBy?: string;
};

function parseEvent(value: unknown): KitchenEventContent {
  return kitchenEventSchema.parse(value);
}

export function buildOrderCreated(
  overrides: OrderIdentityOverrides & {
    customerId?: string;
    customerName?: string;
  } = {},
): KitchenEventContent {
  const orderId = overrides.orderId ?? DEFAULT_ORDER_ID;
  const customerId = overrides.customerId ?? DEFAULT_CUSTOMER_ID;
  const customerName = overrides.customerName ?? DEFAULT_CUSTOMER_NAME;

  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "order.created",
    actor: { role: "customer", id: customerId, name: customerName },
    payload: {
      orderId,
      customerId,
      customerName,
      items: [{ menuItemId: "smash-burger", quantity: 1 }],
    },
  });
}

export function buildOrderReady(
  overrides: OrderIdentityOverrides = {},
): KitchenEventContent {
  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "order.ready",
    actor: { role: "cook", id: "cook-1" },
    payload: { orderId: overrides.orderId ?? DEFAULT_ORDER_ID },
  });
}

export function buildStationFailed(
  overrides: {
    roomId?: string;
    affectedOrderIds?: string[];
  } = {},
): KitchenEventContent {
  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "station.failed",
    actor: { role: "manager", id: "mgr-1" },
    payload: { station: "principal" },
    contextHint: {
      stations: { principal: "failed", reserve: "ok" },
      affectedOrderIds: overrides.affectedOrderIds ?? [DEFAULT_ORDER_ID],
    },
  });
}

export function buildOrderAssigned(
  overrides: AgentOrderOverrides & {
    station?: "principal" | "reserve";
    priorityScore?: 1 | 2 | 3;
  } = {},
): KitchenEventContent {
  const orderId = overrides.orderId ?? DEFAULT_ORDER_ID;
  const causedBy = overrides.causedBy ?? DEFAULT_TRIGGER_ID;

  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "order.assigned",
    actor: { role: "agent", id: "coordinator" },
    agentRole: "coordinator",
    causedBy,
    actionKey: buildActionKey({
      triggerId: causedBy,
      agentRole: "coordinator",
      actionType: "order.assigned",
      orderId,
    }),
    thought: "Assigned to keep the line moving",
    payload: {
      orderId,
      station: overrides.station ?? "principal",
      priorityScore: overrides.priorityScore ?? 2,
    },
  });
}

export function buildOrderReassigned(
  overrides: AgentOrderOverrides = {},
): KitchenEventContent {
  const orderId = overrides.orderId ?? DEFAULT_ORDER_ID;
  const causedBy = overrides.causedBy ?? DEFAULT_TRIGGER_ID;

  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "order.reassigned",
    actor: { role: "agent", id: "backup" },
    agentRole: "backup",
    causedBy,
    actionKey: buildActionKey({
      triggerId: causedBy,
      agentRole: "backup",
      actionType: "order.reassigned",
      orderId,
    }),
    thought: "Principal down; moving order to reserve",
    payload: {
      orderId,
      station: "reserve",
      priorityScore: 3,
    },
  });
}

export function buildOrderDelivered(
  overrides: AgentOrderOverrides = {},
): KitchenEventContent {
  const orderId = overrides.orderId ?? DEFAULT_ORDER_ID;
  const causedBy = overrides.causedBy ?? DEFAULT_TRIGGER_ID;

  return parseEvent({
    version: 1,
    roomId: overrides.roomId ?? DEFAULT_ROOM_ID,
    type: "order.delivered",
    actor: { role: "agent", id: "delivery" },
    agentRole: "delivery",
    causedBy,
    actionKey: buildActionKey({
      triggerId: causedBy,
      agentRole: "delivery",
      actionType: "order.delivered",
      orderId,
    }),
    thought: "Order ready; out for delivery",
    payload: { orderId },
  });
}

export function buildPortalEnvelope(
  overrides: {
    id?: string;
    seq?: number;
    timestamp?: number;
    retracted?: boolean;
    content?: KitchenEventContent;
  } = {},
): PortalMessageLike {
  const content = overrides.content ?? buildOrderCreated();
  // Re-parse so envelope content cannot drift from the event contract.
  const parsedContent = parseEvent(content);

  return {
    id: overrides.id ?? "msg_fixture_1",
    seq: overrides.seq ?? 1,
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    retracted: overrides.retracted ?? false,
    ephemeral: false,
    content: parsedContent,
  };
}
