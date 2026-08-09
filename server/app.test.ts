import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildOrderAssigned,
  buildOrderCreated,
  buildOrderReady,
  buildPortalEnvelope,
  buildStationFailed,
} from "../src/domain/fixtures";
import type { PortalMessageLike } from "../src/domain/projection";
import { createApp, honoApp } from "./app";
import type { ModelClient, PortalServerClient } from "./contracts";

const SECRET = "whsec_test_secret";
/** Fixed clock: 2025-01-15T12:00:00.000Z — within signature tolerance. */
const NOW_MS = 1_737_244_800_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const CHANNEL = "kitchen-demo";
const ENVIRONMENT_ID = "env_test";

const ORDER_A = "550e8400-e29b-41d4-a716-446655440001";
const ORDER_B = "550e8400-e29b-41d4-a716-446655440002";
const ORDER_C = "550e8400-e29b-41d4-a716-446655440003";

/** Must match server/agents/decisions.ts fallback constant (hand-copied). */
const COORDINATOR_FALLBACK_THOUGHT =
  "Assigned with available station and default priority.";

/**
 * Signs the exact raw JSON string that will be sent as the request body.
 * Algorithm matches verifyPortalWebhook: HMAC-SHA256(secret, `${t}.${rawBody}`).
 */
function signPortalWebhook(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

/**
 * Complete Portal delivery envelope (agent/docs/portal/webhooks.md).
 * Callers stringify this once and pass that same string as both the signed
 * payload and the HTTP body — never re-serialize after signing.
 */
function buildPortalDelivery(input: {
  id?: string;
  type?: "message.published" | "message.retracted";
  timestamp?: number;
  environmentId?: string;
  channelId?: string;
  data: {
    id?: string;
    seq?: number;
    type?: string;
    kind?: string;
    content: unknown;
    sender?: { id: string; anon: boolean };
    timestamp?: number;
    retracted?: boolean;
    ephemeral?: boolean;
  };
}) {
  const messageId = input.id ?? input.data.id ?? "m_test_1";
  const timestamp = input.timestamp ?? 1_700_000_000_000;
  const dataId = input.data.id ?? messageId;

  return {
    id: messageId,
    type: input.type ?? "message.published",
    timestamp,
    environmentId: input.environmentId ?? ENVIRONMENT_ID,
    channelId: input.channelId ?? CHANNEL,
    data: {
      id: dataId,
      seq: input.data.seq ?? 1,
      type: input.data.type ?? "message",
      kind: input.data.kind ?? "text",
      content: input.data.content,
      sender: input.data.sender ?? { id: "u_human", anon: false },
      timestamp: input.data.timestamp ?? timestamp,
      retracted: input.data.retracted ?? false,
      ephemeral: input.data.ephemeral ?? false,
    },
  };
}

function fakeModel(result: unknown | Error): ModelClient {
  if (result instanceof Error) {
    return { generate: vi.fn().mockRejectedValue(result) };
  }
  return {
    generate: vi.fn().mockImplementation(async ({ schema }) =>
      schema.parse(result),
    ),
  };
}

function fakePortal(options: {
  history?: PortalMessageLike[];
  failHistory?: Error;
  failPublish?: Error;
} = {}): PortalServerClient {
  return {
    readAllHistory: options.failHistory
      ? vi.fn().mockRejectedValue(options.failHistory)
      : vi.fn().mockResolvedValue(options.history ?? []),
    publishAgentEvent: options.failPublish
      ? vi.fn().mockRejectedValue(options.failPublish)
      : vi.fn().mockResolvedValue({
          id: "pub_1",
          seq: 99,
          timestamp: 1_700_000_001_000,
        }),
  };
}

function makeApp(deps: {
  portal: PortalServerClient;
  model: ModelClient | null;
  webhookSecret?: string;
}) {
  return createApp({
    portal: deps.portal,
    model: deps.model,
    webhookSecret: deps.webhookSecret ?? SECRET,
    now: () => NOW_MS,
  });
}

async function postWebhook(
  app: ReturnType<typeof createApp>,
  options: {
    rawBody: string;
    signature?: string;
  },
) {
  const signature =
    options.signature ??
    signPortalWebhook(options.rawBody, SECRET, NOW_SECONDS);

  return app.request("/api/portal/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "portal-signature": signature,
    },
    body: options.rawBody,
  });
}

describe("GET /api/health", () => {
  it("reports that the API is ready", async () => {
    const response = await honoApp.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("POST /api/portal/webhook", () => {
  it("rejects an invalid portal-signature with 401 and zero Portal calls", async () => {
    // Break: route accepts bad signatures or still touches Portal.
    const delivery = buildPortalDelivery({
      id: "msg_sig_bad",
      data: {
        id: "msg_sig_bad",
        seq: 1,
        content: buildOrderCreated({ orderId: ORDER_A }),
      },
    });
    const rawBody = JSON.stringify(delivery);
    const portal = fakePortal();
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "should not run",
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, {
      rawBody,
      signature: `t=${NOW_SECONDS},v1=${"ab".repeat(32)}`,
    });

    expect(response.status).toBe(401);
    expect(portal.readAllHistory).not.toHaveBeenCalled();
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("rejects a signature that does not match the raw request body with 401", async () => {
    // Break: route verifies against re-serialized JSON instead of raw body bytes.
    const delivery = buildPortalDelivery({
      id: "msg_sig_body_mismatch",
      data: {
        id: "msg_sig_body_mismatch",
        seq: 1,
        content: buildOrderCreated({ orderId: ORDER_A }),
      },
    });
    const signedBody = JSON.stringify(delivery);
    const signature = signPortalWebhook(signedBody, SECRET, NOW_SECONDS);
    // Byte-different body (trailing space); signature stays for the original string.
    const mismatchedBody = `${signedBody} `;
    const portal = fakePortal();
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "should not run",
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, {
      rawBody: mismatchedBody,
      signature,
    });

    expect(response.status).toBe(401);
    expect(portal.readAllHistory).not.toHaveBeenCalled();
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("ignores message.retracted deliveries", async () => {
    // Break: retracts are planned or published as agent work.
    const delivery = buildPortalDelivery({
      id: "retract_m_retract_1",
      type: "message.retracted",
      data: {
        id: "m_retract_1",
        seq: 7,
        content: null,
        retracted: true,
      },
    });
    const rawBody = JSON.stringify(delivery);
    const portal = fakePortal();
    const model = fakeModel({ thought: "should not run" });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ignored: true,
    });
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("ignores agent-authored events", async () => {
    // Break: agent order.assigned is treated as a human trigger.
    const delivery = buildPortalDelivery({
      id: "msg_agent_authored",
      data: {
        id: "msg_agent_authored",
        seq: 3,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: "msg_prior_human",
        }),
        sender: { id: "agent-coordinator", anon: false },
      },
    });
    const rawBody = JSON.stringify(delivery);
    const portal = fakePortal();
    const model = fakeModel({ thought: "should not run" });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ignored: true,
    });
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("ignores unknown domain events", async () => {
    // Break: unknown content types are planned or return an error.
    const delivery = buildPortalDelivery({
      id: "msg_unknown_domain",
      data: {
        id: "msg_unknown_domain",
        seq: 4,
        content: {
          version: 1,
          roomId: CHANNEL,
          type: "chaos.meteor",
          actor: { role: "customer", id: "cust-x", name: "X" },
          payload: { severity: "high" },
        },
      },
    });
    const rawBody = JSON.stringify(delivery);
    const portal = fakePortal();
    const model = fakeModel({ thought: "should not run" });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ignored: true,
    });
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("ignores invalid event contracts", async () => {
    // Break: schema-invalid human-shaped content is planned or 4xx'd.
    const delivery = buildPortalDelivery({
      id: "msg_invalid_contract",
      data: {
        id: "msg_invalid_contract",
        seq: 5,
        content: {
          version: 1,
          roomId: "not-a-valid-room",
          type: "order.created",
          actor: { role: "customer", id: "cust-1", name: "Ada" },
          payload: {
            // missing orderId; invalid roomId
            customerId: "cust-1",
            customerName: "Ada",
            items: [{ menuItemId: "smash-burger", quantity: 1 }],
          },
        },
      },
    });
    const rawBody = JSON.stringify(delivery);
    const portal = fakePortal();
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "should not run",
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ignored: true,
    });
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("publishes the exact Coordinator order.assigned for order.created", async () => {
    // Break: wrong type, actionKey, model fields, or channel on publish.
    const triggerId = "msg_coord_route_1";
    const content = buildOrderCreated({ orderId: ORDER_A });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 10,
        content,
        sender: { id: "cust-1", anon: false },
      },
    });
    const rawBody = JSON.stringify(delivery);
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "Line clear; assign principal.",
    });
    const portal = fakePortal({ history: [] });
    const app = makeApp({ portal, model });

    // Hand-derived expected publish (not from planAgentEvents / buildActionKey).
    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      published: 1,
    });
    expect(portal.publishAgentEvent).toHaveBeenCalledTimes(1);
    expect(portal.publishAgentEvent).toHaveBeenCalledWith(CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      causedBy: triggerId,
      actionKey: `msg_coord_route_1:coordinator:order.assigned:${ORDER_A}`,
      thought: "Line clear; assign principal.",
      payload: {
        orderId: ORDER_A,
        station: "principal",
        priorityScore: 2,
      },
    });
  });

  it("publishes exact Backup order.reassigned events for station.failed", async () => {
    // Break: wrong count, includes reserve order, wrong station/priority, or shared causedBy lost.
    const triggerId = "msg_backup_route_1";
    const content = buildStationFailed({
      affectedOrderIds: [ORDER_A, ORDER_B],
    });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 20,
        content,
        sender: { id: "mgr-1", anon: false },
      },
    });
    const rawBody = JSON.stringify(delivery);

    const history: PortalMessageLike[] = [
      buildPortalEnvelope({
        id: "hist_a_created",
        seq: 1,
        content: buildOrderCreated({ orderId: ORDER_A }),
      }),
      buildPortalEnvelope({
        id: "hist_a_assigned",
        seq: 2,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: "hist_a_created",
          station: "principal",
          priorityScore: 2,
        }),
      }),
      buildPortalEnvelope({
        id: "hist_b_created",
        seq: 3,
        content: buildOrderCreated({ orderId: ORDER_B }),
      }),
      buildPortalEnvelope({
        id: "hist_b_assigned",
        seq: 4,
        content: buildOrderAssigned({
          orderId: ORDER_B,
          causedBy: "hist_b_created",
          station: "principal",
          priorityScore: 2,
        }),
      }),
      buildPortalEnvelope({
        id: "hist_c_created",
        seq: 5,
        content: buildOrderCreated({ orderId: ORDER_C }),
      }),
      buildPortalEnvelope({
        id: "hist_c_assigned",
        seq: 6,
        content: buildOrderAssigned({
          orderId: ORDER_C,
          causedBy: "hist_c_created",
          station: "reserve",
          priorityScore: 1,
        }),
      }),
    ];

    const model = fakeModel({ thought: "Moving principal work to reserve." });
    const portal = fakePortal({ history });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      published: 2,
    });
    expect(portal.publishAgentEvent).toHaveBeenCalledTimes(2);

    // Hand-derived: ORDER_A then ORDER_B by createdSeq; never ORDER_C (reserve).
    const expectedThought = "Moving principal work to reserve.";
    expect(portal.publishAgentEvent).toHaveBeenNthCalledWith(1, CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.reassigned",
      actor: { role: "agent", id: "backup" },
      agentRole: "backup",
      causedBy: triggerId,
      actionKey: `msg_backup_route_1:backup:order.reassigned:${ORDER_A}`,
      thought: expectedThought,
      payload: {
        orderId: ORDER_A,
        station: "reserve",
        priorityScore: 3,
      },
    });
    expect(portal.publishAgentEvent).toHaveBeenNthCalledWith(2, CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.reassigned",
      actor: { role: "agent", id: "backup" },
      agentRole: "backup",
      causedBy: triggerId,
      actionKey: `msg_backup_route_1:backup:order.reassigned:${ORDER_B}`,
      thought: expectedThought,
      payload: {
        orderId: ORDER_B,
        station: "reserve",
        priorityScore: 3,
      },
    });
  });

  it("publishes the exact Delivery order.delivered for order.ready", async () => {
    // Break: delivery skips ready orders or publishes wrong payload/actionKey.
    const triggerId = "msg_delivery_route_1";
    const content = buildOrderReady({ orderId: ORDER_A });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 30,
        content,
        sender: { id: "cook-1", anon: false },
      },
    });
    const rawBody = JSON.stringify(delivery);

    const history: PortalMessageLike[] = [
      buildPortalEnvelope({
        id: "hist_d_created",
        seq: 1,
        content: buildOrderCreated({ orderId: ORDER_A }),
      }),
      buildPortalEnvelope({
        id: "hist_d_assigned",
        seq: 2,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: "hist_d_created",
          station: "principal",
          priorityScore: 2,
        }),
      }),
    ];

    const model = fakeModel({ thought: "Runner taking the ready ticket." });
    const portal = fakePortal({ history });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      published: 1,
    });
    expect(portal.publishAgentEvent).toHaveBeenCalledTimes(1);
    expect(portal.publishAgentEvent).toHaveBeenCalledWith(CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.delivered",
      actor: { role: "agent", id: "delivery" },
      agentRole: "delivery",
      causedBy: triggerId,
      actionKey: `msg_delivery_route_1:delivery:order.delivered:${ORDER_A}`,
      thought: "Runner taking the ready ticket.",
      payload: { orderId: ORDER_A },
    });
  });

  it("replays without calling the model or publishing when actionKey is already applied", async () => {
    // Break: replay re-plans, re-publishes, or returns a non-2xx.
    const triggerId = "msg_replay_coord_1";
    const content = buildOrderCreated({ orderId: ORDER_A });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 40,
        content,
      },
    });
    const rawBody = JSON.stringify(delivery);

    const history: PortalMessageLike[] = [
      buildPortalEnvelope({
        id: triggerId,
        seq: 40,
        content,
      }),
      buildPortalEnvelope({
        id: "hist_replay_assigned",
        seq: 41,
        content: buildOrderAssigned({
          orderId: ORDER_A,
          causedBy: triggerId,
          station: "principal",
          priorityScore: 2,
        }),
      }),
    ];

    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "should not run on replay",
    });
    const portal = fakePortal({ history });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    expect(model.generate).not.toHaveBeenCalled();
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
  });

  it("uses model rejection fallback and still publishes with 200", async () => {
    // Break: model throw becomes 5xx or skips fallback publish.
    const triggerId = "msg_model_timeout_1";
    const content = buildOrderCreated({ orderId: ORDER_A });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 50,
        content,
      },
    });
    const rawBody = JSON.stringify(delivery);
    const model = fakeModel(new Error("timeout"));
    const portal = fakePortal({ history: [] });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      published: 1,
    });
    expect(model.generate).toHaveBeenCalled();
    expect(portal.publishAgentEvent).toHaveBeenCalledTimes(1);
    expect(portal.publishAgentEvent).toHaveBeenCalledWith(CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      causedBy: triggerId,
      actionKey: `msg_model_timeout_1:coordinator:order.assigned:${ORDER_A}`,
      thought: COORDINATOR_FALLBACK_THOUGHT,
      payload: {
        orderId: ORDER_A,
        station: "principal",
        priorityScore: 2,
      },
    });
  });

  it("returns 502 when Portal publish fails", async () => {
    // Break: publish errors are swallowed as 200 or mapped to the wrong status.
    const triggerId = "msg_publish_fail_1";
    const content = buildOrderCreated({ orderId: ORDER_A });
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 60,
        content,
      },
    });
    const rawBody = JSON.stringify(delivery);
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "Assigning principal.",
    });
    const portal = fakePortal({
      history: [],
      failPublish: new Error("portal unavailable"),
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(502);
    expect(portal.publishAgentEvent).toHaveBeenCalled();
  });

  it("recovers from history failure when compact contextHint is sufficient", async () => {
    // Break: history errors always 5xx even when contextHint can drive planning.
    const triggerId = "msg_hist_hint_ok";
    // Coordinator: stations in contextHint are enough without full history.
    const content = {
      ...buildOrderCreated({ orderId: ORDER_A }),
      contextHint: {
        stations: { principal: "ok" as const, reserve: "ok" as const },
        affectedOrderIds: [] as string[],
      },
    };
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 70,
        content,
      },
    });
    const rawBody = JSON.stringify(delivery);
    const model = fakeModel({
      station: "principal",
      priorityScore: 2,
      thought: "Hint recovery; assign principal.",
    });
    const portal = fakePortal({
      failHistory: new Error("history unavailable"),
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      published: 1,
    });
    expect(portal.readAllHistory).toHaveBeenCalled();
    expect(portal.publishAgentEvent).toHaveBeenCalledTimes(1);
    expect(portal.publishAgentEvent).toHaveBeenCalledWith(CHANNEL, {
      version: 1,
      roomId: CHANNEL,
      type: "order.assigned",
      actor: { role: "agent", id: "coordinator" },
      agentRole: "coordinator",
      causedBy: triggerId,
      actionKey: `msg_hist_hint_ok:coordinator:order.assigned:${ORDER_A}`,
      thought: "Hint recovery; assign principal.",
      payload: {
        orderId: ORDER_A,
        station: "principal",
        priorityScore: 2,
      },
    });
  });

  it("returns 503 when history fails and compact context is insufficient", async () => {
    // Break: insufficient recovery is treated as success or wrong status code.
    // Backup without contextHint cannot safely choose which orders to reassign.
    const triggerId = "msg_hist_hint_insufficient";
    const content = {
      version: 1 as const,
      roomId: CHANNEL,
      type: "station.failed" as const,
      actor: { role: "manager" as const, id: "mgr-1" },
      payload: { station: "principal" as const },
      // deliberately omit contextHint
    };
    const delivery = buildPortalDelivery({
      id: triggerId,
      data: {
        id: triggerId,
        seq: 80,
        content,
      },
    });
    const rawBody = JSON.stringify(delivery);
    const model = fakeModel({ thought: "should not publish" });
    const portal = fakePortal({
      failHistory: new Error("history unavailable"),
    });
    const app = makeApp({ portal, model });

    const response = await postWebhook(app, { rawBody });

    expect(response.status).toBe(503);
    expect(portal.publishAgentEvent).not.toHaveBeenCalled();
  });
});
