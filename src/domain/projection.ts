export type HumanRole = "customer" | "cook" | "manager";
export type AgentRole = "coordinator" | "backup" | "delivery";
export type OrderStage = "received" | "cooking" | "ready" | "delivered";
export type StationId = "principal" | "reserve";
export type StationStatus = "ok" | "failed";
export type PriorityScore = 1 | 2 | 3;

export type PortalMessageLike = {
  id: string;
  seq: number;
  timestamp: number;
  retracted: boolean;
  ephemeral: false;
  content: unknown;
};

export type PresenceMeta = {
  displayName: string;
  role: HumanRole;
};

export type OrderItem = {
  menuItemId: "smash-burger" | "veggie-bowl" | "loaded-fries";
  quantity: 1 | 2 | 3;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  stage: OrderStage;
  station: StationId | null;
  priorityScore: PriorityScore | null;
  createdSeq: number;
  updatedSeq: number;
};

export type AgentActivity = {
  thought: string;
  lastActionKey: string;
  updatedSeq: number;
};

export type KitchenProjection = {
  roomId: string;
  orders: Record<string, Order>;
  stations: Record<StationId, StationStatus>;
  agents: Record<AgentRole, AgentActivity | null>;
  appliedMessageIds: Record<string, true>;
  appliedActionKeys: Record<string, true>;
};

export function createEmptyProjection(roomId: string): KitchenProjection {
  return {
    roomId,
    orders: {},
    stations: {
      principal: "ok",
      reserve: "ok",
    },
    agents: {
      coordinator: null,
      backup: null,
      delivery: null,
    },
    appliedMessageIds: {},
    appliedActionKeys: {},
  };
}
