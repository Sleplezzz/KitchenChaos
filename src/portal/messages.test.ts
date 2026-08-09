import { describe, expect, it } from "vitest";
import { kitchenEventSchema } from "../domain/events";
import {
  buildOrderAssigned,
  buildOrderCreated as buildDomainOrderCreated,
  buildPortalEnvelope,
  type PortalMessageLike,
} from "../domain/fixtures";
import { projectKitchen } from "../domain/reducer";
import {
  buildOrderCreated,
  buildOrderReady,
  buildStationFailed,
  projectPortalMessages,
} from "./messages";
import { toRoomId } from "./room";

const ROOM_ID = "kitchen-demo";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_B = "550e8400-e29b-41d4-a716-446655440001";

describe("toRoomId", () => {
  it('normalizes "  ABC-42 " to kitchen-abc42', () => {
    expect(toRoomId("  ABC-42 ")).toBe("kitchen-abc42");
  });

  it("throws for a code that is too short after normalization", () => {
    expect(() => toRoomId("a")).toThrow();
  });

  it("accepts four letters or digits after normalization", () => {
    expect(toRoomId("Ab-1!")).toBe("kitchen-ab1");
    expect(toRoomId("wxyz")).toBe("kitchen-wxyz");
  });

  it("accepts twelve letters or digits after normalization", () => {
    expect(toRoomId("AbCdEfGhIjKl")).toBe("kitchen-abcdefghijkl");
    expect(toRoomId("1234-5678-90AB")).toBe("kitchen-1234567890ab");
  });

  it("throws when fewer than four letters or digits remain", () => {
    expect(() => toRoomId("ab")).toThrow();
    expect(() => toRoomId("a-b-c")).toThrow();
    expect(() => toRoomId("   ")).toThrow();
  });

  it("throws when more than twelve letters or digits remain", () => {
    expect(() => toRoomId("abcdefghijklm")).toThrow();
    expect(() => toRoomId("1234567890abc")).toThrow();
  });
});

describe("browser human event builders", () => {
  it("builds a valid order.created event", () => {
    const event = buildOrderCreated({
      roomId: ROOM_ID,
      customerId: "cust-1",
      customerName: "Ada",
      items: [{ menuItemId: "smash-burger", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(event.type).toBe("order.created");
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
  });

  it("builds a valid order.ready event", () => {
    const event = buildOrderReady({
      roomId: ROOM_ID,
      cookId: "cook-1",
      orderId: ORDER_ID,
    });

    expect(event.type).toBe("order.ready");
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
  });

  it("builds a valid station.failed event", () => {
    const event = buildStationFailed({
      roomId: ROOM_ID,
      managerId: "mgr-1",
      affectedOrderIds: [ORDER_ID],
    });

    expect(event.type).toBe("station.failed");
    expect(kitchenEventSchema.safeParse(event).success).toBe(true);
  });
});

describe("human event message size", () => {
  it("keeps UTF-8 encoded JSON for every human event under 2,048 bytes", () => {
    const humanEvents = [
      buildOrderCreated({
        roomId: ROOM_ID,
        customerId: "cust-1",
        customerName: "Ada",
        items: [
          { menuItemId: "smash-burger", quantity: 1 },
          { menuItemId: "veggie-bowl", quantity: 2 },
          { menuItemId: "loaded-fries", quantity: 3 },
        ],
        orderId: ORDER_ID,
      }),
      buildOrderReady({
        roomId: ROOM_ID,
        cookId: "cook-1",
        orderId: ORDER_ID,
      }),
      buildStationFailed({
        roomId: ROOM_ID,
        managerId: "mgr-1",
        affectedOrderIds: [ORDER_ID, ORDER_B],
      }),
    ];

    for (const event of humanEvents) {
      const bytes = new TextEncoder().encode(JSON.stringify(event)).byteLength;
      expect(bytes).toBeLessThan(2048);
    }
  });
});

describe("projection adapter", () => {
  it("matches projectKitchen when Portal messages arrive out of order", () => {
    const created = buildDomainOrderCreated({
      roomId: ROOM_ID,
      orderId: ORDER_ID,
    });
    const assigned = buildOrderAssigned({
      roomId: ROOM_ID,
      orderId: ORDER_ID,
      causedBy: "msg_created",
    });

    const ascending: PortalMessageLike[] = [
      buildPortalEnvelope({
        id: "msg_created",
        seq: 1,
        content: created,
      }),
      buildPortalEnvelope({
        id: "msg_assigned",
        seq: 2,
        content: assigned,
      }),
    ];

    const unordered: PortalMessageLike[] = [ascending[1]!, ascending[0]!];

    const fromAdapter = projectPortalMessages(ROOM_ID, unordered);
    const fromAscending = projectKitchen(ROOM_ID, ascending);

    expect(fromAdapter).toEqual(fromAscending);
  });
});
