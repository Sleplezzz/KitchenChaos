import { describe, it, expect } from "vitest";
import { buildActionKey } from "./actionKey.js";

describe("buildActionKey", () => {
  it("genera la misma clave para los mismos inputs (determinismo)", () => {
    const params = {
      triggerId: "msg_123",
      agentRole: "coordinator" as const,
      actionType: "order.assigned",
      orderId: "order-1",
    };

    expect(buildActionKey(params)).toBe(buildActionKey({ ...params }));
  });

  it("sigue el formato <triggerId>:<agentRole>:<actionType>:<orderId>", () => {
    const key = buildActionKey({
      triggerId: "msg_123",
      agentRole: "backup",
      actionType: "order.reassigned",
      orderId: "order-9",
    });

    expect(key).toBe("msg_123:backup:order.reassigned:order-9");
  });

  it("genera claves distintas si cambia cualquier componente", () => {
    const base = {
      triggerId: "msg_123",
      agentRole: "delivery" as const,
      actionType: "order.delivered",
      orderId: "order-1",
    };

    const differentTrigger = buildActionKey({ ...base, triggerId: "msg_999" });
    const differentOrder = buildActionKey({ ...base, orderId: "order-2" });
    const differentRole = buildActionKey({ ...base, agentRole: "coordinator" });

    const original = buildActionKey(base);
    expect(differentTrigger).not.toBe(original);
    expect(differentOrder).not.toBe(original);
    expect(differentRole).not.toBe(original);
  });

  it("distintos orderId del mismo evento Backup producen claves distintas (una reasignación es idempotente por pedido)", () => {
    const forOrderA = buildActionKey({
      triggerId: "msg_500",
      agentRole: "backup",
      actionType: "order.reassigned",
      orderId: "order-A",
    });
    const forOrderB = buildActionKey({
      triggerId: "msg_500",
      agentRole: "backup",
      actionType: "order.reassigned",
      orderId: "order-B",
    });

    expect(forOrderA).not.toBe(forOrderB);
  });
});
