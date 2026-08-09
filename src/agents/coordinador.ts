import { CoordinatorDecisionSchema } from "./schemas.js";
import { coordinatorFallback } from "./fallbacks.js";
import { getGatewayModel, type GatewayModel } from "../ai/gateway.js";
import type { CoordinatorDecision, CoordinatorInput } from "./types.js";

export type GenerateCoordinatorDecision = (
  model: GatewayModel,
  input: CoordinatorInput
) => Promise<unknown>;

async function callModel(model: GatewayModel, input: CoordinatorInput): Promise<unknown> {
  // Import perezoso: así los tests que inyectan un fake nunca necesitan
  // que el paquete "ai" esté resuelto ni hacer red.
  const { generateObject } = await import("ai");
  const { object } = await generateObject({
    model: model.modelId,
    schema: CoordinatorDecisionSchema,
    abortSignal: AbortSignal.timeout(8000),
    prompt: [
      "Eres el agente Coordinator de una cocina compartida en tiempo real.",
      `Un nuevo pedido #${input.orderId} con ${input.itemCount} ítem(s) acaba de llegar.`,
      `Pedidos activos ahora mismo: ${input.projection.activeOrderCount}.`,
      `Estación Principal fallida: ${input.projection.principalStationFailed ? "sí" : "no"}.`,
      "Asigna la estación (principal o reserve) y una prioridad de 1 a 3.",
      "Congestión = 3 o más pedidos activos; usa prioridad 2 por defecto si no hay congestión.",
      "Da una explicación operativa de una sola frase corta, sin razonamiento interno.",
    ].join("\n"),
  });
  return object;
}

export interface CoordinatorDeps {
  model?: GatewayModel | null;
  generateDecision?: GenerateCoordinatorDecision;
}

function applyDomainRules(
  decision: CoordinatorDecision,
  input: CoordinatorInput
): CoordinatorDecision {
  if (input.projection.principalStationFailed && decision.station === "principal") {
    return { ...decision, station: "reserve" };
  }
  return decision;
}

export async function decideCoordinator(
  input: CoordinatorInput,
  deps: CoordinatorDeps = {}
): Promise<CoordinatorDecision> {
  const model = deps.model === undefined ? getGatewayModel() : deps.model;
  const generateDecision = deps.generateDecision ?? callModel;

  if (!model) {
    return applyDomainRules(coordinatorFallback(input), input);
  }

  try {
    // Una sola llamada acotada por trigger — sin reintentos, sin loop.
    const raw = await generateDecision(model, input);
    const parsed = CoordinatorDecisionSchema.safeParse(raw);
    if (!parsed.success) {
      return applyDomainRules(coordinatorFallback(input), input);
    }
    return applyDomainRules(parsed.data, input);
  } catch {
    // Timeout, error del proveedor, o cualquier fallo de red.
    return applyDomainRules(coordinatorFallback(input), input);
  }
}
