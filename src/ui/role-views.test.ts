import { describe, expect, it } from "vitest";
import {
  createEmptyProjection,
  type KitchenProjection,
  type Order,
  type OrderItem,
  type OrderStage,
  type PriorityScore,
  type StationId,
  type StationStatus,
} from "../domain/projection";
import {
  buildCustomerOrderItems,
  formatPriority,
  groupCookQueueByStation,
  isPrincipalChaosControlEnabled,
  isPrincipalChaosEnabled,
  principalChaosDisabledReason,
  selectCustomerOrderRows,
  selectManagerBoard,
  type QuantityDraft,
} from "./role-views";

function makeOrder(
  overrides: Partial<Order> & Pick<Order, "id" | "createdSeq">,
): Order {
  return {
    customerId: "cust-1",
    customerName: "Ada",
    items: [{ menuItemId: "smash-burger", quantity: 1 }],
    stage: "received",
    station: null,
    priorityScore: null,
    updatedSeq: overrides.createdSeq,
    ...overrides,
  };
}

function withOrders(
  orders: Order[],
  stations?: Partial<Record<StationId, StationStatus>>,
): KitchenProjection {
  const projection = createEmptyProjection("kitchen-demo");
  for (const order of orders) {
    projection.orders[order.id] = order;
  }
  if (stations) {
    projection.stations = { ...projection.stations, ...stations };
  }
  return projection;
}

describe("formatPriority", () => {
  it("maps 1–3 to P1–P3 and omits null priority", () => {
    expect(formatPriority(1)).toBe("P1");
    expect(formatPriority(2)).toBe("P2");
    expect(formatPriority(3)).toBe("P3");
    expect(formatPriority(null)).toBeNull();
  });
});

describe("buildCustomerOrderItems", () => {
  it("builds OrderItem lines only for quantities 1–3 and omits zeros", () => {
    const draft: QuantityDraft = {
      "smash-burger": 2,
      "veggie-bowl": 0,
      "loaded-fries": 3,
    };

    expect(buildCustomerOrderItems(draft)).toEqual({
      ok: true,
      value: [
        { menuItemId: "smash-burger", quantity: 2 },
        { menuItemId: "loaded-fries", quantity: 3 },
      ] satisfies OrderItem[],
    });
  });

  it("rejects a draft with no selected lines", () => {
    expect(
      buildCustomerOrderItems({
        "smash-burger": 0,
        "veggie-bowl": 0,
        "loaded-fries": 0,
      }),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects non-publishable quantities outside 0–3", () => {
    expect(
      buildCustomerOrderItems({
        "smash-burger": 4,
        "veggie-bowl": 0,
        "loaded-fries": 0,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("selectCustomerOrderRows", () => {
  it("returns only the current customer's orders in selector order", () => {
    const projection = withOrders([
      makeOrder({
        id: "o-mine-later",
        createdSeq: 2,
        customerId: "cust-1",
        stage: "cooking",
        station: "principal",
        priorityScore: 3,
      }),
      makeOrder({
        id: "o-other",
        createdSeq: 1,
        customerId: "cust-2",
        stage: "received",
      }),
      makeOrder({
        id: "o-mine-first",
        createdSeq: 0,
        customerId: "cust-1",
        stage: "received",
        priorityScore: null,
      }),
    ]);

    const rows = selectCustomerOrderRows(projection, "cust-1");
    expect(rows.map((row) => row.id)).toEqual(["o-mine-first", "o-mine-later"]);
    expect(rows[0]).toMatchObject({
      id: "o-mine-first",
      stage: "received",
      station: null,
      priorityLabel: null,
    });
    expect(rows[1]).toMatchObject({
      id: "o-mine-later",
      stage: "cooking",
      station: "principal",
      priorityLabel: "P3",
    });
  });
});

describe("groupCookQueueByStation", () => {
  it("groups the cook queue into Principal and Reserve without reordering", () => {
    const projection = withOrders([
      makeOrder({
        id: "low-p",
        createdSeq: 1,
        stage: "cooking",
        station: "principal",
        priorityScore: 1,
      }),
      makeOrder({
        id: "high-r",
        createdSeq: 2,
        stage: "cooking",
        station: "reserve",
        priorityScore: 3,
      }),
      makeOrder({
        id: "mid-p",
        createdSeq: 3,
        stage: "cooking",
        station: "principal",
        priorityScore: 2,
      }),
      makeOrder({
        id: "received",
        createdSeq: 0,
        stage: "received",
        station: null,
      }),
    ]);

    const groups = groupCookQueueByStation(projection);
    // selectCookQueue order: high-r (P3), mid-p (P2), low-p (P1)
    expect(groups.suggestedNextId).toBe("high-r");
    expect(groups.principal.map((order) => order.id)).toEqual([
      "mid-p",
      "low-p",
    ]);
    expect(groups.reserve.map((order) => order.id)).toEqual(["high-r"]);
    expect(groups.readyEligibleIds.sort()).toEqual(
      ["high-r", "low-p", "mid-p"].sort(),
    );
  });

  it("returns empty station groups and no suggested id when queue is empty", () => {
    const groups = groupCookQueueByStation(createEmptyProjection("kitchen-demo"));
    expect(groups.principal).toEqual([]);
    expect(groups.reserve).toEqual([]);
    expect(groups.suggestedNextId).toBeNull();
    expect(groups.readyEligibleIds).toEqual([]);
  });
});

describe("selectManagerBoard", () => {
  it("groups all orders into four stages by stable createdSeq", () => {
    const stages: OrderStage[] = [
      "received",
      "cooking",
      "ready",
      "delivered",
    ];
    const orders = stages.flatMap((stage, stageIndex) => [
      makeOrder({
        id: `${stage}-b`,
        createdSeq: stageIndex * 10 + 2,
        stage,
        station: stage === "received" ? null : "principal",
        priorityScore: (stage === "received"
          ? null
          : 2) as PriorityScore | null,
      }),
      makeOrder({
        id: `${stage}-a`,
        createdSeq: stageIndex * 10 + 1,
        stage,
        station: stage === "received" ? null : "reserve",
        priorityScore: (stage === "received"
          ? null
          : 1) as PriorityScore | null,
      }),
    ]);

    const board = selectManagerBoard(withOrders(orders));
    expect(board.received.map((order) => order.id)).toEqual([
      "received-a",
      "received-b",
    ]);
    expect(board.cooking.map((order) => order.id)).toEqual([
      "cooking-a",
      "cooking-b",
    ]);
    expect(board.ready.map((order) => order.id)).toEqual([
      "ready-a",
      "ready-b",
    ]);
    expect(board.delivered.map((order) => order.id)).toEqual([
      "delivered-a",
      "delivered-b",
    ]);
  });

  it("exposes both station states from the projection", () => {
    const board = selectManagerBoard(
      withOrders([], { principal: "failed", reserve: "ok" }),
    );
    expect(board.stations).toEqual({ principal: "failed", reserve: "ok" });
  });
});

describe("isPrincipalChaosEnabled", () => {
  it("is enabled only while principal station is ok", () => {
    expect(isPrincipalChaosEnabled({ principal: "ok", reserve: "ok" })).toBe(
      true,
    );
    expect(
      isPrincipalChaosEnabled({ principal: "failed", reserve: "ok" }),
    ).toBe(false);
    expect(
      isPrincipalChaosEnabled({ principal: "ok", reserve: "failed" }),
    ).toBe(true);
  });
});

describe("isPrincipalChaosControlEnabled", () => {
  const okStations = { principal: "ok" as const, reserve: "ok" as const };
  const failedStations = {
    principal: "failed" as const,
    reserve: "ok" as const,
  };

  it("disables after an accepted failure request even while projection still says principal is ok", () => {
    // Publish ACK arrived, but station.failed has not been projected yet.
    expect(
      isPrincipalChaosControlEnabled({
        stations: okStations,
        portalReady: true,
        pending: false,
        submitted: true,
      }),
    ).toBe(false);
    expect(
      principalChaosDisabledReason({
        stations: okStations,
        portalReady: true,
        pending: false,
        submitted: true,
      }),
    ).toMatch(/accepted|waiting|submitted|request/i);
  });

  it("stays disabled while a failure request is pending", () => {
    expect(
      isPrincipalChaosControlEnabled({
        stations: okStations,
        portalReady: true,
        pending: true,
        submitted: false,
      }),
    ).toBe(false);
  });

  it("restores enablement after a rejected publish (idle form, principal still ok)", () => {
    expect(
      isPrincipalChaosControlEnabled({
        stations: okStations,
        portalReady: true,
        pending: false,
        submitted: false,
      }),
    ).toBe(true);
    expect(
      principalChaosDisabledReason({
        stations: okStations,
        portalReady: true,
        pending: false,
        submitted: false,
      }),
    ).toBeNull();
  });

  it("stays disabled once projection shows principal failed", () => {
    expect(
      isPrincipalChaosControlEnabled({
        stations: failedStations,
        portalReady: true,
        pending: false,
        submitted: false,
      }),
    ).toBe(false);
    expect(
      principalChaosDisabledReason({
        stations: failedStations,
        portalReady: true,
        pending: false,
        submitted: false,
      }),
    ).toMatch(/failed/i);
  });
});
