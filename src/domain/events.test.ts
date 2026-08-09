import { describe, expect, it } from "vitest";
import { buildActionKey, kitchenEventSchema } from "./events";
import {
  buildOrderAssigned,
  buildOrderCreated,
  buildOrderDelivered,
  buildOrderReady,
  buildOrderReassigned,
  buildPortalEnvelope,
  buildStationFailed,
} from "./fixtures";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const ROOM_ID = "kitchen-demo";
const TRIGGER_ID = "m_42";

const baseHuman = {
  version: 1 as const,
  roomId: ROOM_ID,
};

const baseAgent = {
  version: 1 as const,
  roomId: ROOM_ID,
  causedBy: TRIGGER_ID,
  thought: "Assigned to keep the line moving",
};

describe("kitchenEventSchema acceptance", () => {
  it("accepts order.created from customer", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "order.created",
      actor: { role: "customer", id: "cust-1", name: "Ada" },
      payload: {
        orderId: ORDER_ID,
        customerId: "cust-1",
        customerName: "Ada",
        items: [{ menuItemId: "smash-burger", quantity: 1 }],
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts order.ready from cook", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "order.ready",
      actor: { role: "cook", id: "cook-1" },
      payload: { orderId: ORDER_ID },
    });

    expect(result.success).toBe(true);
  });

  it("accepts station.failed from manager", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "station.failed",
      actor: { role: "manager", id: "mgr-1" },
      payload: { station: "principal" },
      contextHint: {
        stations: { principal: "failed", reserve: "ok" },
        affectedOrderIds: [ORDER_ID],
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts order.assigned from coordinator", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      actionKey: `${TRIGGER_ID}:coordinator:order.assigned:${ORDER_ID}`,
      payload: {
        orderId: ORDER_ID,
        station: "principal",
        priorityScore: 2,
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts order.reassigned from backup", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.reassigned",
      actor: { role: "agent", id: "backup" },
      agentRole: "backup",
      actionKey: `${TRIGGER_ID}:backup:order.reassigned:${ORDER_ID}`,
      thought: "Principal down; moving order to reserve",
      payload: {
        orderId: ORDER_ID,
        station: "reserve",
        priorityScore: 3,
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts order.delivered from delivery", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.delivered",
      actor: { role: "agent", id: "delivery" },
      agentRole: "delivery",
      actionKey: `${TRIGGER_ID}:delivery:order.delivered:${ORDER_ID}`,
      thought: "Order ready; out for delivery",
      payload: { orderId: ORDER_ID },
    });

    expect(result.success).toBe(true);
  });
});

describe("kitchenEventSchema rejection", () => {
  it("rejects version 2", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      version: 2,
      type: "order.ready",
      actor: { role: "cook", id: "cook-1" },
      payload: { orderId: ORDER_ID },
    });

    expect(result.success).toBe(false);
  });

  it("rejects priorityScore 0", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      actionKey: `${TRIGGER_ID}:coordinator:order.assigned:${ORDER_ID}`,
      payload: {
        orderId: ORDER_ID,
        station: "principal",
        priorityScore: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects priorityScore 4", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      actionKey: `${TRIGGER_ID}:coordinator:order.assigned:${ORDER_ID}`,
      payload: {
        orderId: ORDER_ID,
        station: "principal",
        priorityScore: 4,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a Principal failure that names Reserve", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "station.failed",
      actor: { role: "manager", id: "mgr-1" },
      payload: { station: "reserve" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an agent event without causedBy", () => {
    const result = kitchenEventSchema.safeParse({
      version: 1,
      roomId: ROOM_ID,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      actionKey: `${TRIGGER_ID}:coordinator:order.assigned:${ORDER_ID}`,
      thought: "Assigned to keep the line moving",
      payload: {
        orderId: ORDER_ID,
        station: "principal",
        priorityScore: 2,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an agent event without actionKey", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      payload: {
        orderId: ORDER_ID,
        station: "principal",
        priorityScore: 2,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an explanation longer than 120 characters", () => {
    const longThought = "x".repeat(121);
    const result = kitchenEventSchema.safeParse({
      ...baseAgent,
      type: "order.delivered",
      actor: { role: "agent", id: "delivery" },
      agentRole: "delivery",
      actionKey: `${TRIGGER_ID}:delivery:order.delivered:${ORDER_ID}`,
      thought: longThought,
      payload: { orderId: ORDER_ID },
    });

    expect(result.success).toBe(false);
  });

  it("rejects order.created from a non-customer author", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "order.created",
      actor: { role: "cook", id: "cook-1" },
      payload: {
        orderId: ORDER_ID,
        customerId: "cust-1",
        customerName: "Ada",
        items: [{ menuItemId: "smash-burger", quantity: 1 }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects order.ready from a non-cook author", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "order.ready",
      actor: { role: "customer", id: "cust-1" },
      payload: { orderId: ORDER_ID },
    });

    expect(result.success).toBe(false);
  });

  it("rejects station.failed from a non-manager author", () => {
    const result = kitchenEventSchema.safeParse({
      ...baseHuman,
      type: "station.failed",
      actor: { role: "cook", id: "cook-1" },
      payload: { station: "principal" },
    });

    expect(result.success).toBe(false);
  });
});

describe("buildActionKey stability", () => {
  it("builds a stable colon-delimited action key", () => {
    expect(
      buildActionKey({
        triggerId: "m_42",
        agentRole: "backup",
        actionType: "order.reassigned",
        orderId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toBe("m_42:backup:order.reassigned:550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("domain fixture builders", () => {
  it("builds a valid order.created event", () => {
    const event = buildOrderCreated();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("order.created");
  });

  it("builds a valid order.ready event", () => {
    const event = buildOrderReady();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("order.ready");
  });

  it("builds a valid station.failed event", () => {
    const event = buildStationFailed();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("station.failed");
  });

  it("builds a valid order.assigned event", () => {
    const event = buildOrderAssigned();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("order.assigned");
  });

  it("builds a valid order.reassigned event", () => {
    const event = buildOrderReassigned();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("order.reassigned");
  });

  it("builds a valid order.delivered event", () => {
    const event = buildOrderDelivered();
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe("order.delivered");
  });

  it("applies order identity overrides", () => {
    const orderId = "550e8400-e29b-41d4-a716-446655440099";
    const event = buildOrderCreated({ orderId });
    expect(event.type).toBe("order.created");
    if (event.type === "order.created") {
      expect(event.payload.orderId).toBe(orderId);
    }
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
  });

  it("builds a Portal envelope with the required fields", () => {
    const content = buildOrderCreated();
    const envelope = buildPortalEnvelope({ content, seq: 7 });

    expect(envelope).toEqual({
      id: expect.any(String),
      seq: 7,
      timestamp: expect.any(Number),
      retracted: false,
      ephemeral: false,
      content,
    });
    expect(kitchenEventSchema.safeParse(envelope.content).success).toBe(true);
  });
});
