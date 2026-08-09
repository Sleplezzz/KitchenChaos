import { BackupDecisionSchema } from "./schemas.js";
import { backupFallback } from "./fallbacks.js";
import { getGatewayModel, type GatewayModel } from "../ai/gateway.js";
import type { BackupDecision, BackupInput, Reassignment } from "./types.js";

export type GenerateBackupDecision = (model: GatewayModel, input: BackupInput) => Promise<unknown>;

async function callModel(model: GatewayModel, input: BackupInput): Promise<unknown> {
  const { generateObject } = await import("ai");
  const { object } = await generateObject({
    model: model.modelId,
    schema: BackupDecisionSchema,
    abortSignal: AbortSignal.timeout(8000),
    prompt: [
      "Eres el agente Backup de una cocina compartida en tiempo real.",
      "La estación Principal acaba de fallar.",
      `Pedidos afectados: ${input.affectedOrderIds.length}.`,
      "Da una explicación operativa corta de la recuperación, de una sola frase.",
      "No decides el destino de los pedidos: eso ya está definido (van a Reserva, prioridad 3).",
    ].join("\n"),
  });
  return object;
}

export interface BackupDeps {
  model?: GatewayModel | null;
  generateDecision?: GenerateBackupDecision;
}

export async function decideBackup(
  input: BackupInput,
  deps: BackupDeps = {}
): Promise<BackupDecision> {
  const model = deps.model === undefined ? getGatewayModel() : deps.model;
  const generateDecision = deps.generateDecision ?? callModel;

  if (!model) {
    return backupFallback(input);
  }

  try {
    const raw = await generateDecision(model, input);
    const parsed = BackupDecisionSchema.safeParse(raw);
    if (!parsed.success) {
      return backupFallback(input);
    }
    return parsed.data;
  } catch {
    return backupFallback(input);
  }
}

export function buildReassignments(affectedOrderIds: string[]): Reassignment[] {
  return affectedOrderIds.map((orderId) => ({
    orderId,
    station: "reserve" as const,
    priority: 3 as const,
  }));
}
