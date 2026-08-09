import type {
  BackupDecision,
  BackupInput,
  CoordinatorDecision,
  CoordinatorInput,
  DeliveryDecision,
  DeliveryInput,
} from "./types.js";

/**
 * Se activan ante timeout del
 * modelo, error del proveedor, falta de API key, o resultado inválido.
 * Son puros y no llaman red — el modelo mejora la explicación visible,
 * pero JAMÁS controla si la demo puede terminar.
 */

export function coordinatorFallback(input: CoordinatorInput): CoordinatorDecision {
  const station = input.projection.principalStationFailed ? "reserve" : "principal";
  return {
    station,
    priority: 2,
    thought: "Asignación automática: estación disponible, prioridad estándar.",
  };
}

export function backupFallback(_input: BackupInput): BackupDecision {
  return {
    thought: "Recuperación automática: pedidos afectados movidos a Reserva.",
  };
}

export function deliveryFallback(_input: DeliveryInput): DeliveryDecision {
  return {
    thought: "Entrega confirmada automáticamente.",
  };
}
