import {
  buildActionKey,
  type AgentKitchenEvent,
  type ContextHint,
  type HumanKitchenEvent,
} from "../../src/domain/events";
import type {
  KitchenProjection,
  PortalMessageLike,
  PriorityScore,
  StationId,
} from "../../src/domain/projection";
import { selectAffectedPrincipalOrders } from "../../src/domain/selectors";
import type { ModelClient } from "../contracts";
import {
  coordinatorDecisionSchema,
  thoughtDecisionSchema,
  type CoordinatorDecision,
} from "./schemas";

/** Stable coordinator thought when model is null, throws, or returns invalid data. */
const COORDINATOR_FALLBACK_THOUGHT =
  "Assigned with available station and default priority.";

const BACKUP_FALLBACK_THOUGHT =
  "Principal failed; reassigned affected orders to reserve.";

const DELIVERY_FALLBACK_THOUGHT = "Order ready; confirming delivery.";

export async function planAgentEvents(input: {
  trigger: PortalMessageLike;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint: ContextHint | null;
  model: ModelClient | null;
}): Promise<AgentKitchenEvent[]> {
  switch (input.event.type) {
    case "order.created":
      return planCoordinator(input);
    case "station.failed":
      return planBackup(input);
    case "order.ready":
      return planDelivery(input);
    default: {
      const _exhaustive: never = input.event;
      return _exhaustive;
    }
  }
}

async function planCoordinator(input: {
  trigger: PortalMessageLike;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint: ContextHint | null;
  model: ModelClient | null;
}): Promise<AgentKitchenEvent[]> {
  if (input.event.type !== "order.created") {
    return [];
  }

  const orderId = input.event.payload.orderId;
  const actionKey = buildActionKey({
    triggerId: input.trigger.id,
    agentRole: "coordinator",
    actionType: "order.assigned",
    orderId,
  });

  if (isActionApplied(input.projection, actionKey)) {
    return [];
  }

  const principalFailed = isPrincipalFailed(
    input.projection,
    input.contextHint,
  );
  const decision = await resolveCoordinatorDecision({
    event: input.event,
    projection: input.projection,
    principalFailed,
    model: input.model,
  });

  const station: StationId =
    principalFailed && decision.station === "principal"
      ? "reserve"
      : decision.station;

  const event: AgentKitchenEvent = {
    version: 1,
    roomId: input.event.roomId,
    type: "order.assigned",
    actor: { role: "agent", id: "coordinator" },
    agentRole: "coordinator",
    causedBy: input.trigger.id,
    actionKey,
    thought: decision.thought,
    payload: {
      orderId,
      station,
      priorityScore: decision.priorityScore,
    },
  };

  return [event];
}

async function planBackup(input: {
  trigger: PortalMessageLike;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint: ContextHint | null;
  model: ModelClient | null;
}): Promise<AgentKitchenEvent[]> {
  if (input.event.type !== "station.failed") {
    return [];
  }

  const orderIds = resolveBackupOrderIds(
    input.projection,
    input.contextHint,
  );
  if (orderIds.length === 0) {
    return [];
  }

  // Filter applied action keys before any model work so fully applied
  // Backup retries return [] without paying for a generate call.
  const pending = orderIds
    .map((orderId) => {
      const actionKey = buildActionKey({
        triggerId: input.trigger.id,
        agentRole: "backup",
        actionType: "order.reassigned",
        orderId,
      });
      return { orderId, actionKey };
    })
    .filter(({ actionKey }) => !isActionApplied(input.projection, actionKey));

  if (pending.length === 0) {
    return [];
  }

  const thought = await resolveThoughtDecision({
    model: input.model,
    system:
      "You are the Backup agent in a shared real-time kitchen. Principal just failed.",
    prompt: [
      `Affected principal orders: ${pending.length}.`,
      "Write one short operational recovery explanation.",
      "Do not choose destinations; every affected order goes to reserve at priority 3.",
    ].join("\n"),
    fallbackThought: BACKUP_FALLBACK_THOUGHT,
  });

  const events: AgentKitchenEvent[] = [];
  for (const { orderId, actionKey } of pending) {
    events.push({
      version: 1,
      roomId: input.event.roomId,
      type: "order.reassigned",
      actor: { role: "agent", id: "backup" },
      agentRole: "backup",
      causedBy: input.trigger.id,
      actionKey,
      thought,
      payload: {
        orderId,
        station: "reserve",
        priorityScore: 3,
      },
    });
  }
  return events;
}

async function planDelivery(input: {
  trigger: PortalMessageLike;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint: ContextHint | null;
  model: ModelClient | null;
}): Promise<AgentKitchenEvent[]> {
  if (input.event.type !== "order.ready") {
    return [];
  }

  const orderId = input.event.payload.orderId;
  const actionKey = buildActionKey({
    triggerId: input.trigger.id,
    agentRole: "delivery",
    actionType: "order.delivered",
    orderId,
  });

  if (isActionApplied(input.projection, actionKey)) {
    return [];
  }

  const thought = await resolveThoughtDecision({
    model: input.model,
    system:
      "You are the Delivery agent in a shared real-time kitchen.",
    prompt: [
      `Order ${orderId} is ready.`,
      "Write one short operational delivery explanation.",
    ].join("\n"),
    fallbackThought: DELIVERY_FALLBACK_THOUGHT,
  });

  const event: AgentKitchenEvent = {
    version: 1,
    roomId: input.event.roomId,
    type: "order.delivered",
    actor: { role: "agent", id: "delivery" },
    agentRole: "delivery",
    causedBy: input.trigger.id,
    actionKey,
    thought,
    payload: { orderId },
  };

  return [event];
}

async function resolveCoordinatorDecision(input: {
  event: Extract<HumanKitchenEvent, { type: "order.created" }>;
  projection: KitchenProjection | null;
  principalFailed: boolean;
  model: ModelClient | null;
}): Promise<CoordinatorDecision> {
  const fallback = coordinatorFallback(input.principalFailed);

  if (!input.model) {
    return fallback;
  }

  const activeOrderCount = countActiveOrders(input.projection);
  const itemCount = input.event.payload.items.length;

  try {
    const raw = await input.model.generate({
      schema: coordinatorDecisionSchema,
      system:
        "You are the Coordinator agent in a shared real-time kitchen.",
      prompt: [
        `New order ${input.event.payload.orderId} with ${itemCount} item(s).`,
        `Active orders: ${activeOrderCount}.`,
        `Principal station failed: ${input.principalFailed ? "yes" : "no"}.`,
        "Assign station (principal or reserve) and priorityScore 1-3.",
        "Congestion is 3 or more active orders; use priority 2 by default when quiet.",
        "Write one short operational explanation (max 120 characters).",
      ].join("\n"),
    });

    const parsed = coordinatorDecisionSchema.safeParse(raw);
    if (!parsed.success) {
      return fallback;
    }
    return parsed.data;
  } catch {
    return fallback;
  }
}

async function resolveThoughtDecision(input: {
  model: ModelClient | null;
  system: string;
  prompt: string;
  fallbackThought: string;
}): Promise<string> {
  if (!input.model) {
    return input.fallbackThought;
  }

  try {
    const raw = await input.model.generate({
      schema: thoughtDecisionSchema,
      system: input.system,
      prompt: input.prompt,
    });
    const parsed = thoughtDecisionSchema.safeParse(raw);
    if (!parsed.success) {
      return input.fallbackThought;
    }
    return parsed.data.thought;
  } catch {
    return input.fallbackThought;
  }
}

function coordinatorFallback(principalFailed: boolean): CoordinatorDecision {
  return {
    station: principalFailed ? "reserve" : "principal",
    priorityScore: 2 as PriorityScore,
    thought: COORDINATOR_FALLBACK_THOUGHT,
  };
}

function isPrincipalFailed(
  projection: KitchenProjection | null,
  contextHint: ContextHint | null,
): boolean {
  if (projection) {
    return projection.stations.principal === "failed";
  }
  return contextHint?.stations.principal === "failed";
}

function countActiveOrders(projection: KitchenProjection | null): number {
  if (!projection) {
    return 0;
  }
  return Object.values(projection.orders).filter(
    (order) => order.stage !== "delivered",
  ).length;
}

function resolveBackupOrderIds(
  projection: KitchenProjection | null,
  contextHint: ContextHint | null,
): string[] {
  if (projection) {
    return selectAffectedPrincipalOrders(projection)
      .slice()
      .sort((a, b) => a.createdSeq - b.createdSeq)
      .map((order) => order.id);
  }
  return contextHint?.affectedOrderIds ?? [];
}

function isActionApplied(
  projection: KitchenProjection | null,
  actionKey: string,
): boolean {
  return Boolean(projection?.appliedActionKeys[actionKey]);
}
