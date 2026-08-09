import { describe, it, expect, vi } from "vitest";
import { decideBackup, buildReassignments } from "./backup.js";
import type { BackupInput } from "./types.js";

function makeInput(overrides: Partial<BackupInput> = {}): BackupInput {
  return {
    triggerId: "trigger-2",
    affectedOrderIds: ["order-1", "order-2"],
    projection: { activeOrderCount: 2, principalStationFailed: true },
    ...overrides,
  };
}

describe("decideBackup", () => {
  it("usa la explicación del modelo cuando la salida es válida", async () => {
    const generateDecision = vi.fn().mockResolvedValue({ thought: "Reubicando pedidos en Reserva." });

    const result = await decideBackup(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toBe("Reubicando pedidos en Reserva.");
    expect(generateDecision).toHaveBeenCalledTimes(1);
  });

  it("cae al fallback si la salida no calza con el esquema", async () => {
    const generateDecision = vi.fn().mockResolvedValue({ thought: "" }); // vacío, viola el schema

    const result = await decideBackup(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toMatch(/recuperación automática/i);
  });

  it("cae al fallback si el modelo falla", async () => {
    const generateDecision = vi.fn().mockRejectedValue(new Error("provider error"));

    const result = await decideBackup(makeInput(), {
      model: { modelId: "fake/model" },
      generateDecision,
    });

    expect(result.thought).toMatch(/recuperación automática/i);
  });

  it("usa el fallback de inmediato sin modelo configurado", async () => {
    const generateDecision = vi.fn();
    const result = await decideBackup(makeInput(), { model: null, generateDecision });

    expect(generateDecision).not.toHaveBeenCalled();
    expect(result.thought).toMatch(/recuperación automática/i);
  });
});

describe("buildReassignments", () => {
  it("mueve cada pedido afectado a Reserva con prioridad 3, sin depender del modelo", () => {
    const result = buildReassignments(["order-1", "order-2", "order-3"]);

    expect(result).toEqual([
      { orderId: "order-1", station: "reserve", priority: 3 },
      { orderId: "order-2", station: "reserve", priority: 3 },
      { orderId: "order-3", station: "reserve", priority: 3 },
    ]);
  });

  it("devuelve una lista vacía si no hay pedidos afectados", () => {
    expect(buildReassignments([])).toEqual([]);
  });
});
