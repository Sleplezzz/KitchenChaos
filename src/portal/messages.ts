import {
  kitchenEventSchema,
  type KitchenEventContent,
} from "../domain/events";
import type {
  KitchenProjection,
  OrderItem,
  PortalMessageLike,
} from "../domain/projection";
import { projectKitchen } from "../domain/reducer";

type BuildOrderCreatedInput = {
  roomId: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  orderId: string;
};

type BuildOrderReadyInput = {
  roomId: string;
  cookId: string;
  orderId: string;
};

type BuildStationFailedInput = {
  roomId: string;
  managerId: string;
  affectedOrderIds: string[];
  reserveStatus?: "ok" | "failed";
};

/** Browser/SDK message fields needed to project kitchen history. */
export type ProjectablePortalMessage = {
  id: string;
  timestamp: number;
  retracted: boolean;
  content: unknown;
  /** Present on domain fixtures and server envelopes; absent on public SDK Message. */
  seq?: number;
  ephemeral?: boolean;
  /**
   * Local delivery state on public SDK messages.
   * Omit for fixture/server envelopes (accepted). SDK rows project only when `"sent"`.
   */
  status?: "pending" | "sent" | "failed";
};

export function buildOrderCreated(
  input: BuildOrderCreatedInput,
): KitchenEventContent {
  return kitchenEventSchema.parse({
    version: 1,
    roomId: input.roomId,
    type: "order.created",
    actor: {
      role: "customer",
      id: input.customerId,
      name: input.customerName,
    },
    payload: {
      orderId: input.orderId,
      customerId: input.customerId,
      customerName: input.customerName,
      items: input.items,
    },
  });
}

export function buildOrderReady(
  input: BuildOrderReadyInput,
): KitchenEventContent {
  return kitchenEventSchema.parse({
    version: 1,
    roomId: input.roomId,
    type: "order.ready",
    actor: { role: "cook", id: input.cookId },
    payload: { orderId: input.orderId },
  });
}

export function buildStationFailed(
  input: BuildStationFailedInput,
): KitchenEventContent {
  return kitchenEventSchema.parse({
    version: 1,
    roomId: input.roomId,
    type: "station.failed",
    actor: { role: "manager", id: input.managerId },
    payload: { station: "principal" },
    contextHint: {
      stations: {
        principal: "failed",
        reserve: input.reserveStatus ?? "ok",
      },
      affectedOrderIds: input.affectedOrderIds,
    },
  });
}

/**
 * Adapt Portal history (fixture envelopes with `seq`, or public SDK `Message`
 * without `seq`) into a kitchen projection.
 */
export function projectPortalMessages(
  roomId: string,
  messages: readonly ProjectablePortalMessage[],
): KitchenProjection {
  const durable = messages.filter((message) => {
    if (message.ephemeral) {
      return false;
    }
    // Fixture/server envelopes have no status; public SDK rows project only when sent.
    return message.status === undefined || message.status === "sent";
  });

  const adapted: PortalMessageLike[] = durable.map((message, index) => ({
    id: message.id,
    seq: typeof message.seq === "number" ? message.seq : index + 1,
    timestamp: message.timestamp,
    retracted: message.retracted,
    ephemeral: false,
    content: message.content,
  }));

  return projectKitchen(roomId, adapted);
}
