export type AgentRole = "coordinator" | "backup" | "delivery";

export type Station = "principal" | "reserve";

export type Priority = 1 | 2 | 3;

/** Proyección compacta de la sala — solo los campos que cada agente necesita para decidir. */
export interface RoomProjectionCompact {
  /** Número de pedidos activos (Received | Cooking | Ready) en la sala. */
  activeOrderCount: number;
  /** true si la estación Principal ya fue marcada como fallida. */
  principalStationFailed: boolean;
}

export interface CoordinatorInput {
  triggerId: string;
  orderId: string;
  itemCount: number;
  projection: RoomProjectionCompact;
}

export interface CoordinatorDecision {
  station: Station;
  priority: Priority;
  thought: string;
}

export interface BackupInput {
  triggerId: string;
  /** orderIds actualmente asignados a Principal, afectados por la falla. */
  affectedOrderIds: string[];
  projection: RoomProjectionCompact;
}

export interface BackupDecision {
  thought: string;
}

export interface Reassignment {
  orderId: string;
  station: "reserve";
  priority: 3;
}

export interface DeliveryInput {
  triggerId: string;
  orderId: string;
  projection: RoomProjectionCompact;
}

export interface DeliveryDecision {
  thought: string;
}
