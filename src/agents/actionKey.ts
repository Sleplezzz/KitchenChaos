import type { AgentRole } from "./types.js";

/**
 * `actionKey` determinista (diseño §8.1):
 *   <triggerId>:<agentRole>:<actionType>:<orderId>
 *
 * Esto es la mitad "generación de la clave" de la idempotencia. La otra
 * mitad — rechazar una acción cuya actionKey ya fue aplicada — vive en
 * el reducer/webhook de una fase posterior, porque necesita el set de
 * actionKeys ya vistos (que hoy vive en Portal, todavía no conectado).
 * Lo que sí podemos garantizar ya, y es lo que testeamos acá, es que la
 * generación de la clave es pura y determinista: mismos inputs, misma
 * clave, siempre — que es lo que hace posible deduplicar más adelante.
 */
export function buildActionKey(params: {
  triggerId: string;
  agentRole: AgentRole;
  actionType: string;
  orderId: string;
}): string {
  const { triggerId, agentRole, actionType, orderId } = params;
  return `${triggerId}:${agentRole}:${actionType}:${orderId}`;
}
