import type { Message } from "@portalsdk/core";
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
    expect(toRoomId("Ab-12!")).toBe("kitchen-ab12");
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

  it("projects real Portal Message objects that have no public seq", () => {
    const created = buildDomainOrderCreated({
      roomId: ROOM_ID,
      orderId: ORDER_ID,
    });
    const assigned = buildOrderAssigned({
      roomId: ROOM_ID,
      orderId: ORDER_ID,
      causedBy: "msg_created",
    });

    const sdkMessages: Message[] = [
      {
        id: "msg_created",
        channelId: ROOM_ID,
        sender: { id: "cust-1", anon: true },
        timestamp: 1_700_000_000_000,
        retracted: false,
        ephemeral: false,
        kind: "text",
        type: "order.created",
        content: created,
        unread: false,
        status: "sent",
      },
      {
        id: "msg_assigned",
        channelId: ROOM_ID,
        sender: { id: "agent-1", anon: false },
        timestamp: 1_700_000_000_100,
        retracted: false,
        ephemeral: false,
        kind: "text",
        type: "order.assigned",
        content: assigned,
        unread: false,
        status: "sent",
      },
    ];

    const projection = projectPortalMessages(ROOM_ID, sdkMessages);

    expect(projection.orders[ORDER_ID]?.stage).toBe("cooking");
    expect(projection.orders[ORDER_ID]?.station).toBe("principal");
  });

  it("projects only sent SDK messages and ignores ephemeral, pending, and failed rows", () => {
    const baseEnvelope = {
      channelId: ROOM_ID,
      sender: { id: "cust-1", anon: true as const },
      timestamp: 1_700_000_000_000,
      retracted: false,
      kind: "text" as const,
      type: "order.created",
      unread: false,
    };

    const orderFor = (orderId: string) =>
      buildDomainOrderCreated({ roomId: ROOM_ID, orderId });

    const ephemeral: Message = {
      ...baseEnvelope,
      id: "msg_ephemeral",
      ephemeral: true,
      content: orderFor("550e8400-e29b-41d4-a716-446655440010"),
      status: "sent",
    };
    const pending: Message = {
      ...baseEnvelope,
      id: "msg_pending",
      ephemeral: false,
      content: orderFor("550e8400-e29b-41d4-a716-446655440011"),
      status: "pending",
    };
    const failed: Message = {
      ...baseEnvelope,
      id: "msg_failed",
      ephemeral: false,
      content: orderFor("550e8400-e29b-41d4-a716-446655440012"),
      status: "failed",
    };
    const sent: Message = {
      ...baseEnvelope,
      id: "msg_sent",
      ephemeral: false,
      content: orderFor(ORDER_ID),
      status: "sent",
    };

    const projection = projectPortalMessages(ROOM_ID, [
      ephemeral,
      pending,
      failed,
      sent,
    ]);

    expect(Object.keys(projection.orders)).toEqual([ORDER_ID]);
    expect(projection.orders[ORDER_ID]?.stage).toBe("received");
    expect(projection.appliedMessageIds).toEqual({ msg_sent: true });
  });
});
