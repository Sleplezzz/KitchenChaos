import type { HumanKitchenEvent } from "../src/domain/events";
import type { PortalMessageLike } from "../src/domain/projection";
import { projectKitchen } from "../src/domain/reducer";
import { planAgentEvents } from "./agents/decisions";
import type {
  ModelClient,
  PortalDelivery,
  PortalServerClient,
} from "./contracts";

/** Success after agent processing (including published: 0 replay / no-op). */
export type OrchestrateOk = {
  published: number;
};

/**
 * Typed failure the route maps to HTTP:
 * - portal_publish → 502
 * - insufficient_history → 503
 */
export class OrchestratorError extends Error {
  readonly code: "portal_publish" | "insufficient_history";

  constructor(
    code: OrchestratorError["code"],
    message: string,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "OrchestratorError";
    this.code = code;
  }
}

export type OrchestrateInput = {
  channelId: string;
  /** Persistent message from the verified delivery `data` (not agent-authored). */
  trigger: PortalMessageLike;
  /** Already parsed with `humanKitchenEventSchema`. */
  event: HumanKitchenEvent;
  portal: PortalServerClient;
  model: ModelClient | null;
};

/**
 * Map Portal delivery data into a PortalMessageLike for history merge / plan.
 */
export function deliveryDataToTrigger(
  data: Pick<
    PortalDelivery["data"],
    "id" | "seq" | "timestamp" | "retracted" | "content"
  >,
): PortalMessageLike {
  return {
    id: data.id,
    seq: data.seq,
    timestamp: data.timestamp,
    retracted: data.retracted,
    ephemeral: false,
    content: data.content,
  };
}

/**
 * Whether compact context is enough to plan when history read fails.
 * order.created: needs contextHint.stations
 * station.failed: needs contextHint (affectedOrderIds may be empty)
 * order.ready: always sufficient from payload.orderId
 */
export function hasSufficientCompactContext(event: HumanKitchenEvent): boolean {
  switch (event.type) {
    case "order.created":
      return event.contextHint?.stations != null;
    case "station.failed":
      return event.contextHint != null;
    case "order.ready":
      return true;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/**
 * History → merge trigger → projection → planAgentEvents → sequential publish.
 * Throws OrchestratorError on 502/503 paths. Never throws on model failure
 * (planner falls back). Does not verify signatures or decide ignore.
 */
export async function orchestrateHumanEvent(
  input: OrchestrateInput,
): Promise<OrchestrateOk> {
  const { channelId, trigger, event, portal, model } = input;

  let history: PortalMessageLike[] = [];
  let historyFailed = false;

  try {
    history = await portal.readAllHistory(channelId);
  } catch {
    history = [];
    historyFailed = true;
  }

  if (historyFailed && !hasSufficientCompactContext(event)) {
    throw new OrchestratorError(
      "insufficient_history",
      "History unavailable and compact context is insufficient.",
    );
  }

  let projection = null;
  if (!historyFailed) {
    const messages = history.some((m) => m.id === trigger.id)
      ? history
      : [...history, trigger];
    projection = projectKitchen(event.roomId, messages);
  }

  const events = await planAgentEvents({
    trigger,
    event,
    projection,
    contextHint: event.contextHint ?? null,
    model,
  });

  let published = 0;
  for (const eventToPublish of events) {
    try {
      await portal.publishAgentEvent(channelId, eventToPublish);
      published += 1;
    } catch (err) {
      throw new OrchestratorError(
        "portal_publish",
        "Portal publishAgentEvent failed.",
        err,
      );
    }
  }

  return { published };
}
