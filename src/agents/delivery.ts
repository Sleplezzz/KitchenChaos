import { DeliveryDecisionSchema } from "./schemas.js";
import { deliveryFallback } from "./fallbacks.js";
import { getGatewayModel, type GatewayModel } from "../ai/gateway.js";
import type { DeliveryDecision, DeliveryInput } from "./types.js";

export type GenerateDeliveryDecision = (model: GatewayModel, input: DeliveryInput) => Promise<unknown>;

async function callModel(model: GatewayModel, input: DeliveryInput): Promise<unknown> {
  const { generateObject } = await import("ai");
  const { object } = await generateObject({
    model: model.modelId,
    schema: DeliveryDecisionSchema,
    abortSignal: AbortSignal.timeout(8000),
    prompt: [
      "Eres el agente Delivery de una cocina compartida en tiempo real.",
      `El pedido #${input.orderId} fue marcado como listo (Ready).`,
      "Da una explicación operativa corta de la entrega, de una sola frase.",
    ].join("\n"),
  });
  return object;
}

export interface DeliveryDeps {
  model?: GatewayModel | null;
  generateDecision?: GenerateDeliveryDecision;
}

export async function decideDelivery(
  input: DeliveryInput,
  deps: DeliveryDeps = {}
): Promise<DeliveryDecision> {
  const model = deps.model === undefined ? getGatewayModel() : deps.model;
  const generateDecision = deps.generateDecision ?? callModel;

  if (!model) {
    return deliveryFallback(input);
  }

  try {
    const raw = await generateDecision(model, input);
    const parsed = DeliveryDecisionSchema.safeParse(raw);
    if (!parsed.success) {
      return deliveryFallback(input);
    }
    return parsed.data;
  } catch {
    return deliveryFallback(input);
  }
}
