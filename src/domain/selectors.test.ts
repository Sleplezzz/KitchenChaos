import { describe, expect, it } from "vitest";
import {
  createEmptyProjection,
  type KitchenProjection,
  type Order,
} from "./projection";
import { selectCookIncomingOrders, selectCookQueue } from "./selectors";

function makeOrder(
  stage: Order["stage"],
  createdSeq: number,
  overrides: Partial<Pick<Order, "station" | "priorityScore">> = {},
): Order {
  return {
    id: crypto.randomUUID(),
    customerId: "selector-test-customer",
    customerName: "Selector Test Customer",
    items: [{ menuItemId: "smash-burger", quantity: 1 }],
    stage,
    station: null,
    priorityScore: null,
    createdSeq,
    updatedSeq: createdSeq,
    ...overrides,
  };
}

function withOrders(orders: Order[]): KitchenProjection {
  const roomCode = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const projection = createEmptyProjection(`kitchen-${roomCode}`);
  for (const order of orders) {
    projection.orders[order.id] = order;
  }
  return projection;
}

describe("selectCookIncomingOrders", () => {
  it("returns only received orders in ascending createdSeq order", () => {
    const receivedLater = makeOrder("received", 30);
    const cooking = makeOrder("cooking", 10, {
      station: "principal",
      priorityScore: 3,
    });
    const delivered = makeOrder("delivered", 5, {
      station: "reserve",
      priorityScore: 2,
    });
    const receivedEarlier = makeOrder("received", 20);
    const ready = makeOrder("ready", 15, {
      station: "principal",
      priorityScore: 1,
    });
    const projection = withOrders([
      receivedLater,
      cooking,
      delivered,
      receivedEarlier,
      ready,
    ]);

    expect(
      selectCookIncomingOrders(projection).map((order) => order.id),
    ).toEqual([receivedEarlier.id, receivedLater.id]);
    expect(selectCookQueue(projection).map((order) => order.id)).toEqual([
      cooking.id,
    ]);
  });

  it("moves an assigned fixture from Incoming to the cooking queue", () => {
    const order = makeOrder("received", 1);
    const receivedProjection = withOrders([order]);

    expect(
      selectCookIncomingOrders(receivedProjection).map((row) => row.id),
    ).toEqual([order.id]);
    expect(selectCookQueue(receivedProjection)).toEqual([]);

    const cookingProjection = withOrders([
      {
        ...order,
        stage: "cooking",
        station: "principal",
        priorityScore: 2,
        updatedSeq: 2,
      },
    ]);

    expect(selectCookIncomingOrders(cookingProjection)).toEqual([]);
    expect(selectCookQueue(cookingProjection).map((row) => row.id)).toEqual([
      order.id,
    ]);
  });
});
