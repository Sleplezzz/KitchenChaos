import { MENU, type MenuItemId } from "../domain/menu";
import type {
  KitchenProjection,
  Order,
  OrderItem,
  OrderStage,
  PriorityScore,
  StationId,
  StationStatus,
} from "../domain/projection";
import { selectCookQueue, selectCustomerOrders } from "../domain/selectors";

export type QuantityDraft = Record<MenuItemId, number>;

export type BuildCustomerOrderItemsResult =
  | { ok: true; value: OrderItem[] }
  | { ok: false; reason: "empty" | "invalid" };

export type CustomerOrderRow = {
  id: string;
  items: OrderItem[];
  stage: OrderStage;
  station: StationId | null;
  priorityLabel: string | null;
};

export type CookQueueGroups = {
  principal: Order[];
  reserve: Order[];
  /** First overall cook-queue order id (suggestion only). */
  suggestedNextId: string | null;
  /** Every cooking order remains a valid Ready action. */
  readyEligibleIds: string[];
};

export type ManagerBoard = {
  received: Order[];
  cooking: Order[];
  ready: Order[];
  delivered: Order[];
  stations: Record<StationId, StationStatus>;
};

const PUBLISHABLE_QUANTITIES = new Set([1, 2, 3]);

/** Format non-null priority as P1/P2/P3; omit the mark when null. */
export function formatPriority(
  score: PriorityScore | null,
): string | null {
  if (score === null) {
    return null;
  }
  return `P${score}`;
}

/**
 * Build Customer OrderItem[] from the three static MENU quantities.
 * Quantity 0 omits a line; only integer quantities 1, 2, and 3 are publishable.
 */
export function buildCustomerOrderItems(
  draft: QuantityDraft,
): BuildCustomerOrderItemsResult {
  const value: OrderItem[] = [];

  for (const item of MENU) {
    const quantity = draft[item.id] ?? 0;
    if (quantity === 0) {
      continue;
    }
    if (!PUBLISHABLE_QUANTITIES.has(quantity)) {
      return { ok: false, reason: "invalid" };
    }
    value.push({
      menuItemId: item.id,
      quantity: quantity as 1 | 2 | 3,
    });
  }

  if (value.length === 0) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, value };
}

/** Customer tickets for me only, reusing selectCustomerOrders order. */
export function selectCustomerOrderRows(
  projection: KitchenProjection,
  customerId: string,
): CustomerOrderRow[] {
  return selectCustomerOrders(projection, customerId).map((order) => ({
    id: order.id,
    items: order.items,
    stage: order.stage,
    station: order.station,
    priorityLabel: formatPriority(order.priorityScore),
  }));
}

/**
 * Group the existing cook queue into Principal and Reserve while preserving
 * priority/creation order. Every returned cooking order remains Ready-eligible.
 */
export function groupCookQueueByStation(
  projection: KitchenProjection,
): CookQueueGroups {
  const queue = selectCookQueue(projection);
  const principal: Order[] = [];
  const reserve: Order[] = [];

  for (const order of queue) {
    if (order.station === "principal") {
      principal.push(order);
    } else if (order.station === "reserve") {
      reserve.push(order);
    }
  }

  return {
    principal,
    reserve,
    suggestedNextId: queue[0]?.id ?? null,
    readyEligibleIds: queue.map((order) => order.id),
  };
}

function ordersByStage(
  projection: KitchenProjection,
  stage: OrderStage,
): Order[] {
  return Object.values(projection.orders)
    .filter((order) => order.stage === stage)
    .sort((a, b) => a.createdSeq - b.createdSeq);
}

/** All projected orders grouped into four stages, each in stable createdSeq order. */
export function selectManagerBoard(
  projection: KitchenProjection,
): ManagerBoard {
  return {
    received: ordersByStage(projection, "received"),
    cooking: ordersByStage(projection, "cooking"),
    ready: ordersByStage(projection, "ready"),
    delivered: ordersByStage(projection, "delivered"),
    stations: {
      principal: projection.stations.principal,
      reserve: projection.stations.reserve,
    },
  };
}

/** Principal chaos is enabled only while principal station is ok. */
export function isPrincipalChaosEnabled(
  stations: Record<StationId, StationStatus>,
): boolean {
  return stations.principal === "ok";
}

/** Form/request inputs that gate the Principal chaos control. */
export type PrincipalChaosControlInput = {
  stations: Record<StationId, StationStatus>;
  portalReady: boolean;
  /** True while a failPrincipal publish is in flight. */
  pending: boolean;
  /**
   * True after publish succeeds and before projection shows principal failed.
   * Prevents a second click during the ACK → projection race.
   */
  submitted: boolean;
};

/**
 * Textual reason the chaos control is disabled, or null when it may be activated.
 * Priority: portal readiness → in-flight → accepted/awaiting projection → already failed.
 */
export function principalChaosDisabledReason(
  input: PrincipalChaosControlInput,
): string | null {
  if (!input.portalReady) {
    return "Portal not ready to publish.";
  }
  if (input.pending) {
    return "Failure request in progress.";
  }
  if (input.submitted) {
    return "Failure request accepted; waiting for station update.";
  }
  if (!isPrincipalChaosEnabled(input.stations)) {
    return "Principal station already failed.";
  }
  return null;
}

/**
 * Whether the Principal chaos control may be activated.
 * Holds disable after an accepted publish until projection catches up.
 */
export function isPrincipalChaosControlEnabled(
  input: PrincipalChaosControlInput,
): boolean {
  return principalChaosDisabledReason(input) === null;
}

/** Empty quantity draft for the three static menu items. */
export function emptyQuantityDraft(): QuantityDraft {
  return {
    "smash-burger": 0,
    "veggie-bowl": 0,
    "loaded-fries": 0,
  };
}

/** Clamp a draft quantity step into the 0–3 UI range. */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(3, Math.max(0, Math.trunc(value)));
}
