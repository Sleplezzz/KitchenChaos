import { describe, expect, it } from "vitest";
import {
  buildOrderAssigned,
  buildOrderCreated,
  buildOrderDelivered,
  buildOrderReady,
  buildOrderReassigned,
  buildPortalEnvelope,
  buildStationFailed,
  type PortalMessageLike,
} from "./fixtures";
import { createEmptyProjection } from "./projection";
import { projectKitchen, reduceKitchen } from "./reducer";
import { selectCookQueue } from "./selectors";

const ROOM_ID = "kitchen-demo";
const ORDER_A = "550e8400-e29b-41d4-a716-446655440001";
const ORDER_B = "550e8400-e29b-41d4-a716-446655440002";
const ORDER_C = "550e8400-e29b-41d4-a716-446655440003";
const ORDER_DEFAULT = "550e8400-e29b-41d4-a716-446655440000";

function empty() {
  return createEmptyProjection(ROOM_ID);
}

function envelope(
  overrides: Parameters<typeof buildPortalEnvelope>[0],
): PortalMessageLike {
  return buildPortalEnvelope(overrides);
}

/** Bypass schema parse so rejection cases can carry invalid content. */
function rawEnvelope(overrides: {
  id?: string;
  seq?: number;
  timestamp?: number;
  retracted?: boolean;
  content: unknown;
}): PortalMessageLike {
  return {
    id: overrides.id ?? "msg_raw",
    seq: overrides.seq ?? 1,
    timestamp: overrides.timestamp ?? 1_700_000_000_000,
    retracted: overrides.retracted ?? false,
    ephemeral: false,
    content: overrides.content as PortalMessageLike["content"],
  };
}

describe("complete order path", () => {
  it("moves an order through received, cooking, ready, and delivered", () => {
    const orderId = ORDER_DEFAULT;
    const created = envelope({
      id: "msg_created",
      seq: 1,
      content: buildOrderCreated({ orderId }),
    });
    const assigned = envelope({
      id: "msg_assigned",
      seq: 2,
      content: buildOrderAssigned({ orderId, causedBy: "msg_created" }),
    });
    const ready = envelope({
      id: "msg_ready",
      seq: 3,
      content: buildOrderReady({ orderId }),
    });
    const delivered = envelope({
      id: "msg_delivered",
      seq: 4,
      content: buildOrderDelivered({ orderId, causedBy: "msg_ready" }),
    });

    let state = empty();

    state = reduceKitchen(state, created);
    expect(state.orders[orderId]?.stage).toBe("received");

    state = reduceKitchen(state, assigned);
    expect(state.orders[orderId]?.stage).toBe("cooking");

    state = reduceKitchen(state, ready);
    expect(state.orders[orderId]?.stage).toBe("ready");

    state = reduceKitchen(state, delivered);
    expect(state.orders[orderId]?.stage).toBe("delivered");
  });
});

describe("cook queue with three active orders", () => {
  it("sorts by higher priority first, then earlier creation seq", () => {
    // ORDER_A: priority 3
    // ORDER_B: priority 2, earlier createdSeq
    // ORDER_C: priority 2, later createdSeq
    const messages: PortalMessageLike[] = [
      envelope({
        id: "msg_b_created",
        seq: 10,
        content: buildOrderCreated({ orderId: ORDER_B }),
      }),
      envelope({
        id: "msg_c_created",
        seq: 20,
        content: buildOrderCreated({ orderId: ORDER_C }),
      }),
      envelope({
        id: "msg_a_created",
        seq: 30,
        content: buildOrderCreated({ orderId: ORDER_A }),
      }),
      envelope({
        id: "msg_b_assigned",
        seq: 40,
        content: buildOrderAssigned({
          orderId: ORDER_B,
          causedBy: "msg_b_created",
          priorityScore: 2,
        }),
      }),
      envelope({
        id: "msg_c_assigned",
        seq: 50,
        content: buildOrderAssigned({
          orderId: ORDER_C,
          causedBy: "msg_c_created",
          priorityScore: 2,
        }),
      }),
      envelope({
        id: "msg_a_assigned",
        seq: 60,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: "msg_a_created",
          priorityScore: 3,
        }),
      }),
    ];

    const projection = projectKitchen(ROOM_ID, messages);

    expect(projection.orders[ORDER_A]?.priorityScore).toBe(3);
    expect(projection.orders[ORDER_B]?.priorityScore).toBe(2);
    expect(projection.orders[ORDER_C]?.priorityScore).toBe(2);
    expect(projection.orders[ORDER_B]?.createdSeq).toBeLessThan(
      projection.orders[ORDER_C]?.createdSeq ?? Number.POSITIVE_INFINITY,
    );

    expect(selectCookQueue(projection).map((order) => order.id)).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003",
    ]);
  });
});

describe("reducer rejection and replay", () => {
  it("ignores a duplicate Portal message ID", () => {
    // Human create has no actionKey. Second delivery reuses the message id with a
    // *different* orderId so a "order already exists" rule cannot explain the no-op —
    // only appliedMessageIds (message-id guard) prevents ORDER_B from appearing.
    const first = envelope({
      id: "msg_dup_id",
      seq: 1,
      content: buildOrderCreated({ orderId: ORDER_A }),
    });
    const secondSameId = envelope({
      id: "msg_dup_id",
      seq: 99,
      content: buildOrderCreated({ orderId: ORDER_B }),
    });

    const once = reduceKitchen(empty(), first);
    const twice = reduceKitchen(once, secondSameId);

    expect(twice).toEqual(once);
    expect(twice.orders[ORDER_A]).toBeDefined();
    expect(twice.orders[ORDER_B]).toBeUndefined();
  });

  it("ignores a duplicate agent actionKey", () => {
    // Second agent event must be stage-legal without the actionKey guard.
    // Reassignment after station.failed is valid while cooking; a second
    // order.assigned is not (invalid stage), so it must not be the fixture.
    //
    // Two Principal orders share one actionKey on the second reassignment so a
    // missing guard would move ORDER_B to reserve — stage rules alone cannot
    // explain the no-op.
    const createdA = envelope({
      id: "msg_ak_a_created",
      seq: 1,
      content: buildOrderCreated({ orderId: ORDER_A }),
    });
    const createdB = envelope({
      id: "msg_ak_b_created",
      seq: 2,
      content: buildOrderCreated({ orderId: ORDER_B }),
    });
    const assignedA = envelope({
      id: "msg_ak_a_assigned",
      seq: 3,
      content: buildOrderAssigned({
        orderId: ORDER_A,
        causedBy: "msg_ak_a_created",
        station: "principal",
        priorityScore: 2,
      }),
    });
    const assignedB = envelope({
      id: "msg_ak_b_assigned",
      seq: 4,
      content: buildOrderAssigned({
        orderId: ORDER_B,
        causedBy: "msg_ak_b_created",
        station: "principal",
        priorityScore: 2,
      }),
    });
    const failed = envelope({
      id: "msg_ak_failed",
      seq: 5,
      content: buildStationFailed({ affectedOrderIds: [ORDER_A, ORDER_B] }),
    });
    const reassignedA = envelope({
      id: "msg_ak_a_reassigned",
      seq: 6,
      content: buildOrderReassigned({
        orderId: ORDER_A,
        causedBy: "msg_ak_failed",
      }),
    });
    const actionKeyA = (
      reassignedA.content as { actionKey: string }
    ).actionKey;
    const reassignedBContent = buildOrderReassigned({
      orderId: ORDER_B,
      causedBy: "msg_ak_failed",
    });
    // Different message id; force the same actionKey already applied for ORDER_A.
    const reassignedBDuplicateKey = rawEnvelope({
      id: "msg_ak_b_reassigned",
      seq: 7,
      content: {
        ...reassignedBContent,
        actionKey: actionKeyA,
      },
    });

    let state = empty();
    state = reduceKitchen(state, createdA);
    state = reduceKitchen(state, createdB);
    state = reduceKitchen(state, assignedA);
    state = reduceKitchen(state, assignedB);
    state = reduceKitchen(state, failed);
    state = reduceKitchen(state, reassignedA);
    expect(state.orders[ORDER_A]?.station).toBe("reserve");
    expect(state.orders[ORDER_B]?.station).toBe("principal");
    expect(state.orders[ORDER_A]?.stage).toBe("cooking");
    expect(state.orders[ORDER_B]?.stage).toBe("cooking");

    const afterDuplicateKey = reduceKitchen(state, reassignedBDuplicateKey);

    // Without actionKey guard, ORDER_B would move to reserve (valid reassignment).
    // With the guard, ORDER_B stays on principal.
    expect(afterDuplicateKey.orders[ORDER_A]?.station).toBe("reserve");
    expect(afterDuplicateKey.orders[ORDER_B]?.station).toBe("principal");
    expect(afterDuplicateKey.orders[ORDER_B]?.priorityScore).toBe(2);
    expect(afterDuplicateKey.orders[ORDER_A]?.stage).toBe("cooking");
    expect(afterDuplicateKey.orders[ORDER_B]?.stage).toBe("cooking");
  });

  it("rejects ready before assigned", () => {
    const orderId = ORDER_DEFAULT;
    const created = envelope({
      id: "msg_ready_early_created",
      seq: 1,
      content: buildOrderCreated({ orderId }),
    });
    const ready = envelope({
      id: "msg_ready_early",
      seq: 2,
      content: buildOrderReady({ orderId }),
    });

    let state = empty();
    state = reduceKitchen(state, created);
    const afterReady = reduceKitchen(state, ready);

    expect(afterReady).toEqual(state);
    expect(afterReady.orders[orderId]?.stage).toBe("received");
  });

  it("rejects delivered before ready", () => {
    const orderId = ORDER_DEFAULT;
    const created = envelope({
      id: "msg_del_early_created",
      seq: 1,
      content: buildOrderCreated({ orderId }),
    });
    const assigned = envelope({
      id: "msg_del_early_assigned",
      seq: 2,
      content: buildOrderAssigned({
        orderId,
        causedBy: "msg_del_early_created",
      }),
    });
    const delivered = envelope({
      id: "msg_del_early",
      seq: 3,
      content: buildOrderDelivered({
        orderId,
        causedBy: "msg_del_early_assigned",
      }),
    });

    let state = empty();
    state = reduceKitchen(state, created);
    state = reduceKitchen(state, assigned);
    const afterDelivered = reduceKitchen(state, delivered);

    expect(afterDelivered).toEqual(state);
    expect(afterDelivered.orders[orderId]?.stage).toBe("cooking");
  });

  it("rejects assignment to a failed station", () => {
    const orderId = ORDER_DEFAULT;
    const created = envelope({
      id: "msg_fail_st_created",
      seq: 1,
      content: buildOrderCreated({ orderId }),
    });
    const failed = envelope({
      id: "msg_fail_st",
      seq: 2,
      content: buildStationFailed({ affectedOrderIds: [orderId] }),
    });
    const assigned = envelope({
      id: "msg_fail_st_assigned",
      seq: 3,
      content: buildOrderAssigned({
        orderId,
        causedBy: "msg_fail_st_created",
        station: "principal",
        priorityScore: 2,
      }),
    });

    let state = empty();
    state = reduceKitchen(state, created);
    state = reduceKitchen(state, failed);
    expect(state.stations.principal).toBe("failed");

    const afterAssign = reduceKitchen(state, assigned);

    expect(afterAssign).toEqual(state);
    expect(afterAssign.orders[orderId]?.stage).toBe("received");
    expect(afterAssign.orders[orderId]?.station).toBeNull();
  });

  it("ignores an unknown event type", () => {
    const unknown = rawEnvelope({
      id: "msg_unknown_type",
      seq: 1,
      content: {
        version: 1,
        roomId: ROOM_ID,
        type: "order.exploded",
        actor: { role: "customer", id: "cust-1", name: "Ada" },
        payload: { orderId: ORDER_DEFAULT },
      },
    });

    const state = empty();
    const after = reduceKitchen(state, unknown);

    expect(after).toEqual(state);
  });

  it("ignores contract version 2", () => {
    const version2 = rawEnvelope({
      id: "msg_version_2",
      seq: 1,
      content: {
        version: 2,
        roomId: ROOM_ID,
        type: "order.created",
        actor: { role: "customer", id: "cust-1", name: "Ada" },
        payload: {
          orderId: ORDER_DEFAULT,
          customerId: "cust-1",
          customerName: "Ada",
          items: [{ menuItemId: "smash-burger", quantity: 1 }],
        },
      },
    });

    const state = empty();
    const after = reduceKitchen(state, version2);

    expect(after).toEqual(state);
  });

  it("ignores a retracted Portal tombstone with null content", () => {
    // Production Portal history/webhooks use tombstones: retracted + content null.
    // Fixtures cannot express that; use a raw envelope and assert no-op without throw.
    const tombstone = rawEnvelope({
      id: "msg_tombstone",
      seq: 1,
      retracted: true,
      content: null,
    });

    const state = empty();
    expect(() => reduceKitchen(state, tombstone)).not.toThrow();
    const after = reduceKitchen(state, tombstone);

    expect(after).toEqual(state);
    expect(after.orders[ORDER_DEFAULT]).toBeUndefined();
  });
});

describe("multi-order station failure and reassignment", () => {
  it("reassigns two Principal orders to Reserve with priority 3 without stage changes", () => {
    // ORDER_A stays cooking; ORDER_B is advanced to ready before failure so
    // "stage unchanged" cannot pass by resetting both orders to cooking.
    const messages: PortalMessageLike[] = [
      envelope({
        id: "msg_mo_a_created",
        seq: 1,
        content: buildOrderCreated({ orderId: ORDER_A }),
      }),
      envelope({
        id: "msg_mo_b_created",
        seq: 2,
        content: buildOrderCreated({ orderId: ORDER_B }),
      }),
      envelope({
        id: "msg_mo_a_assigned",
        seq: 3,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: "msg_mo_a_created",
          station: "principal",
          priorityScore: 2,
        }),
      }),
      envelope({
        id: "msg_mo_b_assigned",
        seq: 4,
        content: buildOrderAssigned({
          orderId: ORDER_B,
          causedBy: "msg_mo_b_created",
          station: "principal",
          priorityScore: 2,
        }),
      }),
      envelope({
        id: "msg_mo_b_ready",
        seq: 5,
        content: buildOrderReady({ orderId: ORDER_B }),
      }),
      envelope({
        id: "msg_mo_failed",
        seq: 6,
        content: buildStationFailed({
          affectedOrderIds: [ORDER_A, ORDER_B],
        }),
      }),
      envelope({
        id: "msg_mo_a_reassigned",
        seq: 7,
        content: buildOrderReassigned({
          orderId: ORDER_A,
          causedBy: "msg_mo_failed",
        }),
      }),
      envelope({
        id: "msg_mo_b_reassigned",
        seq: 8,
        content: buildOrderReassigned({
          orderId: ORDER_B,
          causedBy: "msg_mo_failed",
        }),
      }),
    ];

    const beforeFailure = projectKitchen(ROOM_ID, messages.slice(0, 5));
    expect(beforeFailure.orders[ORDER_A]?.stage).toBe("cooking");
    expect(beforeFailure.orders[ORDER_B]?.stage).toBe("ready");
    expect(beforeFailure.orders[ORDER_A]?.station).toBe("principal");
    expect(beforeFailure.orders[ORDER_B]?.station).toBe("principal");

    const stageA = beforeFailure.orders[ORDER_A]!.stage;
    const stageB = beforeFailure.orders[ORDER_B]!.stage;
    expect(stageA).not.toBe(stageB);

    const projection = projectKitchen(ROOM_ID, messages);

    expect(projection.stations.principal).toBe("failed");
    expect(projection.stations.reserve).toBe("ok");
    expect(projection.orders[ORDER_A]?.station).toBe("reserve");
    expect(projection.orders[ORDER_B]?.station).toBe("reserve");
    expect(projection.orders[ORDER_A]?.priorityScore).toBe(3);
    expect(projection.orders[ORDER_B]?.priorityScore).toBe(3);
    expect(projection.orders[ORDER_A]?.stage).toBe(stageA);
    expect(projection.orders[ORDER_B]?.stage).toBe(stageB);
    expect(projection.orders[ORDER_A]?.stage).toBe("cooking");
    expect(projection.orders[ORDER_B]?.stage).toBe("ready");
  });
});
