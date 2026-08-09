import { describe, expect, it, vi } from "vitest";
import { planAgentEvents } from "./decisions";
import {
  buildOrderCreated,
  buildOrderReady,
  buildStationFailed,
  buildPortalEnvelope,
} from "../../src/domain/fixtures";
import {
  agentKitchenEventSchema,
  buildActionKey,
  type HumanKitchenEvent,
} from "../../src/domain/events";
import {
  createEmptyProjection,
  type KitchenProjection,
  type Order,
  type OrderStage,
  type PriorityScore,
} from "../../src/domain/projection";
import type { ModelClient } from "../contracts";

const ROOM_ID = "kitchen-demo";
const ORDER_A = "550e8400-e29b-41d4-a716-446655440001";
const ORDER_B = "550e8400-e29b-41d4-a716-446655440002";
const ORDER_C = "550e8400-e29b-41d4-a716-446655440003";

/** Stable coordinator thought when model is null, throws, or returns invalid data. */
const COORDINATOR_FALLBACK_THOUGHT =
  "Assigned with available station and default priority.";

function seedOrder(
  partial: Partial<Order> & { id: string },
): Order {
  return {
    id: partial.id,
    customerId: partial.customerId ?? "cust-1",
    customerName: partial.customerName ?? "Ada",
    items: partial.items ?? [{ menuItemId: "smash-burger", quantity: 1 }],
    stage: partial.stage ?? "received",
    station: partial.station ?? null,
    priorityScore: partial.priorityScore ?? null,
    createdSeq: partial.createdSeq ?? 1,
    updatedSeq: partial.updatedSeq ?? 1,
  };
}

function makeProjection(
  patch: {
    orders?: Order[];
    stations?: Partial<KitchenProjection["stations"]>;
    appliedActionKeys?: Record<string, true>;
  } = {},
): KitchenProjection {
  const projection = createEmptyProjection(ROOM_ID);
  for (const order of patch.orders ?? []) {
    projection.orders[order.id] = order;
  }
  if (patch.stations) {
    projection.stations = { ...projection.stations, ...patch.stations };
  }
  if (patch.appliedActionKeys) {
    projection.appliedActionKeys = { ...patch.appliedActionKeys };
  }
  return projection;
}

function makeTrigger(
  content: HumanKitchenEvent,
  id = "msg_test_1",
) {
  return buildPortalEnvelope({ id, content });
}

function fakeModel(
  result: unknown | Error,
): ModelClient {
  if (result instanceof Error) {
    return {
      generate: vi.fn().mockRejectedValue(result),
    };
  }
  return {
    generate: vi.fn().mockImplementation(async ({ schema }) => schema.parse(result)),
  };
}

function callPlanner(input: {
  trigger: ReturnType<typeof makeTrigger>;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint?: HumanKitchenEvent["contextHint"] | null;
  model: ModelClient | null;
}) {
  return planAgentEvents({
    trigger: input.trigger,
    event: input.event,
    projection: input.projection,
    contextHint: input.contextHint ?? input.event.contextHint ?? null,
    model: input.model,
  });
}

function assertValidAgentEvents(events: unknown[]) {
  for (const event of events) {
    expect(() => agentKitchenEventSchema.parse(event)).not.toThrow();
  }
}

describe("planAgentEvents", () => {
  describe("Coordinator", () => {
    it("emits one order.assigned from a valid structured model decision", async () => {
      // Break: planner ignores model station/priority or skips assignment.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_coord_1");
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
      });
      const model = fakeModel({
        station: "principal",
        priorityScore: 2,
        thought: "Line clear; assign principal.",
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.assigned",
        agentRole: "coordinator",
        causedBy: "msg_coord_1",
        actionKey: buildActionKey({
          triggerId: "msg_coord_1",
          agentRole: "coordinator",
          actionType: "order.assigned",
          orderId: ORDER_A,
        }),
        thought: "Line clear; assign principal.",
        payload: {
          orderId: ORDER_A,
          station: "principal",
          priorityScore: 2,
        },
      });
      expect(events[0]!.thought.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.thought.length).toBeLessThanOrEqual(120);
      assertValidAgentEvents(events);
      expect(model.generate).toHaveBeenCalledTimes(1);
    });

    it("uses fallback priority 2 when fewer than three active orders", async () => {
      // Break: fallback uses a non-default priority, random station, or non-deterministic thought.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_coord_fallback");
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
        // Both stations healthy: fallback must pick principal deterministically.
        stations: { principal: "ok", reserve: "ok" },
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model: null,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.assigned",
        agentRole: "coordinator",
        thought: COORDINATOR_FALLBACK_THOUGHT,
        payload: {
          orderId: ORDER_A,
          station: "principal",
          priorityScore: 2,
        },
      });
      expect(events[0]!.thought.length).toBeLessThanOrEqual(120);
      assertValidAgentEvents(events);
    });

    it("forces reserve when Principal is failed even if model chooses principal", async () => {
      // Break: planner trusts model station over domain station health.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_coord_failed");
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
        stations: { principal: "failed", reserve: "ok" },
      });
      const model = fakeModel({
        station: "principal",
        priorityScore: 1,
        thought: "Prefer principal line.",
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        contextHint: {
          stations: { principal: "failed", reserve: "ok" },
          affectedOrderIds: [],
        },
        model,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.assigned",
        payload: {
          orderId: ORDER_A,
          station: "reserve",
        },
      });
      assertValidAgentEvents(events);
    });

    it("uses a short deterministic thought when the model fails", async () => {
      // Break: model rejection propagates, or fallback station/priority/thought drift.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_coord_throw");
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
        stations: { principal: "ok", reserve: "ok" },
      });
      const model = fakeModel(new Error("timeout"));

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.assigned",
        agentRole: "coordinator",
        thought: COORDINATOR_FALLBACK_THOUGHT,
        payload: {
          orderId: ORDER_A,
          station: "principal",
          priorityScore: 2,
        },
      });
      expect(events[0]!.thought.length).toBeLessThanOrEqual(120);
      assertValidAgentEvents(events);
      expect(model.generate).toHaveBeenCalledTimes(1);
    });

    it("activates fallback when model priority is outside 1 to 3", async () => {
      // Break: invalid model priority is accepted into the event payload.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_coord_bad_prio");
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
      });
      const model: ModelClient = {
        generate: vi.fn().mockResolvedValue({
          station: "principal",
          priorityScore: 9,
          thought: "Urgent rush order.",
        }),
      };

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.assigned",
        payload: {
          orderId: ORDER_A,
          priorityScore: 2,
        },
      });
      expect(
        (events[0]!.payload as { priorityScore: PriorityScore }).priorityScore,
      ).not.toBe(9);
      assertValidAgentEvents(events);
    });
  });

  describe("Backup", () => {
    it("reassigns each Principal-active order to reserve with priority 3", async () => {
      // Break: reassigns reserve orders, wrong count, or wrong forced priority/station.
      const content = buildStationFailed({
        affectedOrderIds: [ORDER_A, ORDER_B],
      }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_backup_1");
      const projection = makeProjection({
        orders: [
          seedOrder({
            id: ORDER_A,
            stage: "cooking" as OrderStage,
            station: "principal",
            priorityScore: 2,
            createdSeq: 1,
          }),
          seedOrder({
            id: ORDER_B,
            stage: "cooking" as OrderStage,
            station: "principal",
            priorityScore: 2,
            createdSeq: 2,
          }),
          seedOrder({
            id: ORDER_C,
            stage: "cooking" as OrderStage,
            station: "reserve",
            priorityScore: 1,
            createdSeq: 3,
          }),
        ],
        stations: { principal: "failed", reserve: "ok" },
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        contextHint: content.contextHint ?? null,
        model: null,
      });

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === "order.reassigned")).toBe(true);
      expect(events.every((e) => e.agentRole === "backup")).toBe(true);
      expect(events.every((e) => e.causedBy === "msg_backup_1")).toBe(true);

      const orderIds = events.map((e) => e.payload.orderId).sort();
      expect(orderIds).toEqual([ORDER_A, ORDER_B].sort());

      for (const event of events) {
        expect(event.payload).toMatchObject({
          station: "reserve",
          priorityScore: 3,
        });
        expect(event.thought.length).toBeGreaterThanOrEqual(1);
        expect(event.thought.length).toBeLessThanOrEqual(120);
        expect(event.actionKey).toBe(
          buildActionKey({
            triggerId: "msg_backup_1",
            agentRole: "backup",
            actionType: "order.reassigned",
            orderId: event.payload.orderId,
          }),
        );
      }

      expect(events.some((e) => e.payload.orderId === ORDER_C)).toBe(false);
      assertValidAgentEvents(events);
    });
  });

  describe("Delivery", () => {
    it("emits one order.delivered for a valid order.ready trigger", async () => {
      // Break: delivery skips ready orders or emits wrong type/orderId.
      const content = buildOrderReady({ orderId: ORDER_A }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_delivery_1");
      const projection = makeProjection({
        orders: [
          seedOrder({
            id: ORDER_A,
            stage: "ready",
            station: "principal",
            priorityScore: 2,
          }),
        ],
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model: null,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "order.delivered",
        agentRole: "delivery",
        causedBy: "msg_delivery_1",
        actionKey: buildActionKey({
          triggerId: "msg_delivery_1",
          agentRole: "delivery",
          actionType: "order.delivered",
          orderId: ORDER_A,
        }),
        payload: { orderId: ORDER_A },
      });
      expect(events[0]!.thought.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.thought.length).toBeLessThanOrEqual(120);
      assertValidAgentEvents(events);
    });

    it("returns no events for a non-delivery trigger with no affected work", async () => {
      // Break: planner emits work for a trigger that has nothing to do.
      // station.failed with empty affected list and no principal actives → [].
      const content = buildStationFailed({
        affectedOrderIds: [],
      }) as HumanKitchenEvent;
      const trigger = makeTrigger(content, "msg_delivery_noop");
      const projection = makeProjection({
        orders: [
          seedOrder({
            id: ORDER_C,
            stage: "cooking",
            station: "reserve",
            priorityScore: 1,
          }),
        ],
        stations: { principal: "failed", reserve: "ok" },
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        contextHint: {
          stations: { principal: "failed", reserve: "ok" },
          affectedOrderIds: [],
        },
        model: null,
      });

      expect(events).toEqual([]);
    });
  });

  describe("Idempotency", () => {
    it("returns no events when the planned actionKey is already applied", async () => {
      // Break: planner re-emits an event whose actionKey is already applied.
      const content = buildOrderCreated({ orderId: ORDER_A }) as HumanKitchenEvent;
      const triggerId = "msg_idem_1";
      const trigger = makeTrigger(content, triggerId);
      const actionKey = buildActionKey({
        triggerId,
        agentRole: "coordinator",
        actionType: "order.assigned",
        orderId: ORDER_A,
      });
      const projection = makeProjection({
        orders: [seedOrder({ id: ORDER_A, stage: "received" })],
        appliedActionKeys: { [actionKey]: true },
      });

      const events = await callPlanner({
        trigger,
        event: content,
        projection,
        model: null,
      });

      expect(events).toEqual([]);
    });
  });
});
