import { describe, expect, it } from "vitest";
import {
  portalDeliverySchema,
  type PortalDelivery,
} from "./contracts";

const baseSender = { id: "u_123", anon: false as const };

/** Schema-required persistent message fields only (no wire-only extras). */
const minimalData = {
  id: "m_1752912000_42",
  seq: 42,
  content: {
    version: 1,
    roomId: "kitchen-demo",
    type: "order.created",
    actor: { role: "customer", id: "cust-1", name: "Ada" },
    payload: {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      customerId: "cust-1",
      customerName: "Ada",
      items: [{ menuItemId: "smash-burger", quantity: 1 }],
    },
  },
  sender: baseSender,
  timestamp: 1_752_912_000_000,
  retracted: false,
  ephemeral: false as const,
};

const minimal: PortalDelivery = {
  id: "m_1752912000_42",
  type: "message.published",
  timestamp: 1_752_912_000_000,
  environmentId: "env_abc123",
  channelId: "kitchen-demo",
  data: minimalData,
};

const validRetracted = {
  id: "retract_m_1752912000_42",
  type: "message.retracted" as const,
  timestamp: 1_752_912_000_100,
  environmentId: "env_abc123",
  channelId: "kitchen-demo",
  data: {
    id: "m_1752912000_42",
    seq: 42,
    content: null,
    sender: baseSender,
    timestamp: 1_752_912_000_000,
    retracted: true,
    ephemeral: false as const,
  },
};

describe("portalDeliverySchema", () => {
  it("accepts a minimal valid message.published delivery", () => {
    const result = portalDeliverySchema.safeParse(minimal);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(minimal.id);
      expect(result.data.type).toBe("message.published");
      expect(result.data.channelId).toBe("kitchen-demo");
      expect(result.data.data.seq).toBe(42);
      expect(result.data.data.ephemeral).toBe(false);
    }
  });

  it("accepts documented extra Portal message fields without requiring them in the schema", () => {
    const result = portalDeliverySchema.safeParse({
      ...minimal,
      data: {
        ...minimalData,
        type: "message",
        kind: "text",
        to: ["u_x"],
        mentions: [{ userId: "u_x" }],
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a message.retracted delivery with tombstoned data", () => {
    const result = portalDeliverySchema.safeParse(validRetracted);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("message.retracted");
      expect(result.data.data.retracted).toBe(true);
      expect(result.data.data.content).toBeNull();
    }
  });

  it("rejects when a required top-level field is missing", () => {
    const { channelId: _channelId, ...withoutChannelId } = minimal;
    const result = portalDeliverySchema.safeParse(withoutChannelId);

    expect(result.success).toBe(false);
  });

  it("rejects delivery types other than message.published and message.retracted", () => {
    const result = portalDeliverySchema.safeParse({
      ...minimal,
      type: "message.edited",
    });

    expect(result.success).toBe(false);
  });

  it("rejects persistent data missing seq", () => {
    const { seq: _seq, ...dataWithoutSeq } = minimalData;
    const result = portalDeliverySchema.safeParse({
      ...minimal,
      data: dataWithoutSeq,
    });

    expect(result.success).toBe(false);
  });

  it("rejects persistent data when ephemeral is not false", () => {
    const result = portalDeliverySchema.safeParse({
      ...minimal,
      data: { ...minimalData, ephemeral: true },
    });

    expect(result.success).toBe(false);
  });

  it("accepts documented sender shape with optional username", () => {
    const result = portalDeliverySchema.safeParse({
      ...minimal,
      data: {
        ...minimalData,
        sender: { id: "u_anon", anon: true, username: "guest" },
      },
    });

    expect(result.success).toBe(true);
  });
});
