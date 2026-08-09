import { describe, it, expect, vi } from "vitest";
import { decideCoordinator } from "./coordinator.js";
import type { CoordinatorInput } from "./types.js";

function makeInput(overrides: Partial<CoordinatorInput> = {}): CoordinatorInput {
  return {
    triggerId: "trigger-1",
    orderId: "order-1",
    itemCount: 2,
    projection: { activeOrderCount: 1, principalStationFailed: false },
    ...overrides,
  };
}

describe("decideCoordinator", () => {
  it("usa la decisión del modelo cuando la salida es válida", async () => {
    const generateDecision = vi.fn().mockResolvedValue({
      station: "principal",
      priority: 2,
      thought: "Estación principal libre, prioridad estándar.",
    });

    const result = await decideCoordinator(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result).toEqual({
      station: "principal",
      priority: 2,
      thought: "Estación principal libre, prioridad estándar.",
    });
    expect(generateDecision).toHaveBeenCalledTimes(1); // una sola llamada acotada por trigger
  });

  it("cae al fallback determinista si la salida del modelo no calza con el esquema", async () => {
    const generateDecision = vi.fn().mockResolvedValue({ station: "space-station", priority: 9 });

    const result = await decideCoordinator(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.station).toBe("principal");
    expect(result.priority).toBe(2);
  });

  it("cae al fallback determinista si la llamada al modelo falla (timeout / error de proveedor)", async () => {
    const generateDecision = vi.fn().mockRejectedValue(new Error("timeout"));

    const result = await decideCoordinator(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.priority).toBe(2);
    expect(result.thought).toMatch(/asignación automática/i);
  });

  it("usa el fallback de inmediato, sin llamar al modelo, si no hay key ni modelo configurado", async () => {
    const generateDecision = vi.fn();

    const result = await decideCoordinator(makeInput(), {
      model: null,
      generateDecision,
    });

    expect(generateDecision).not.toHaveBeenCalled();
    expect(result.priority).toBe(2);
  });

  it("nunca asigna a Principal si la estación falló, sin importar lo que diga el modelo", async () => {
    const generateDecision = vi.fn().mockResolvedValue({
      station: "principal", // el modelo se equivoca / no sabe que ya falló
      priority: 1,
      thought: "Mandándolo a la estación principal.",
    });

    const result = await decideCoordinator(
      makeInput({ projection: { activeOrderCount: 1, principalStationFailed: true } }),
      { model: { modelId: "fake/model" }, generateDecision }
    );

    expect(result.station).toBe("reserve");
  });

  it("el fallback también respeta la estación fallida", async () => {
    const result = await decideCoordinator(
      makeInput({ projection: { activeOrderCount: 1, principalStationFailed: true } }),
      { model: null }
    );

    expect(result.station).toBe("reserve");
  });
});
