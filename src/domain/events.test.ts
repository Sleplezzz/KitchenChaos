import { describe, expect, it } from "vitest";
import { buildActionKey, kitchenEventSchema } from "./events";

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
