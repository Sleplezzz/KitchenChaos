import { describe, it, expect, vi } from "vitest";
import { decideDelivery } from "./delivery.js";
import type { DeliveryInput } from "./types.js";

function makeInput(overrides: Partial<DeliveryInput> = {}): DeliveryInput {
  return {
    triggerId: "trigger-3",
    orderId: "order-7",
    projection: { activeOrderCount: 1, principalStationFailed: false },
    ...overrides,
  };
}

describe("decideDelivery", () => {
  it("usa la explicación del modelo cuando la salida es válida", async () => {
    const generateDecision = vi.fn().mockResolvedValue({ thought: "Entregado a tiempo." });

    const result = await decideDelivery(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toBe("Entregado a tiempo.");
    expect(generateDecision).toHaveBeenCalledTimes(1);
  });

  it("cae al fallback si la salida no calza con el esquema", async () => {
    const generateDecision = vi.fn().mockResolvedValue({ notThought: "campo equivocado" });

    const result = await decideDelivery(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toMatch(/entrega confirmada automáticamente/i);
  });

  it("cae al fallback si el modelo hace timeout", async () => {
    const generateDecision = vi.fn().mockRejectedValue(new Error("timeout"));

    const result = await decideDelivery(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toMatch(/entrega confirmada automáticamente/i);
  });

  it("usa el fallback de inmediato sin modelo configurado", async () => {
    const generateDecision = vi.fn();
    const result = await decideDelivery(makeInput(), { model: null, generateDecision });

    expect(generateDecision).not.toHaveBeenCalled();
    expect(result.thought).toMatch(/entrega confirmada automáticamente/i);
  });
});
