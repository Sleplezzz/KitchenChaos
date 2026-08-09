import { describe, expect, it, vi } from "vitest";
import type { AgentKitchenEvent } from "../../src/domain/events";
import { buildOrderCreated, buildOrderReassigned } from "../../src/domain/fixtures";
import { createPortalServerClient } from "./client";

function reassignedEvent(): AgentKitchenEvent {
  return buildOrderReassigned() as AgentKitchenEvent;
}

const SECRET = "sk_test_placeholder_not_real";
const CHANNEL_ID = "kitchen-demo";
const USER_JWT = "jwt_test_user_token";

type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function headerMap(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, String(v)]),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recordCalls(handler: (call: FetchCall, index: number) => Response) {
  const calls: FetchCall[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = headerMap(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const call: FetchCall = { url, method, headers, body };
    const index = calls.length;
    calls.push(call);
    return handler(call, index);
  });
  return { fetchFn, calls };
}

function wireMsg(overrides: {
  id: string;
  seq: number;
  content?: unknown;
  retracted?: boolean;
  timestamp?: number;
}) {
  return {
    id: overrides.id,
    seq: overrides.seq,
    type: "message",
    kind: "text",
    content: overrides.retracted ? null : (overrides.content ?? buildOrderCreated()),
    sender: { id: "u1", anon: true },
    timestamp: overrides.timestamp ?? 1_700_000_000_000 + overrides.seq,
    retracted: overrides.retracted ?? false,
    ephemeral: false,
  };
}

describe("createPortalServerClient", () => {
  it("mints a five-minute connect-only token then pages history ascending without retracted messages", async () => {
    const olderContent = buildOrderCreated({ customerName: "Older" });
    const newerContent = buildOrderCreated({ customerName: "Newer" });
    const retractedContent = buildOrderCreated({ customerName: "Gone" });

    const { fetchFn, calls } = recordCalls((call, index) => {
      if (index === 0) {
        return jsonResponse({
          token: USER_JWT,
          expiresAt: "2026-01-01T00:05:00.000Z",
        });
      }
      if (index === 1) {
        // Newest page (ascending within page). First seq becomes next before.
        return jsonResponse({
          msgs: [
            wireMsg({ id: "m3", seq: 3, content: newerContent }),
            wireMsg({ id: "m4", seq: 4, content: newerContent }),
          ],
          hasMore: true,
        });
      }
      if (index === 2) {
        return jsonResponse({
          msgs: [
            wireMsg({ id: "m1", seq: 1, content: olderContent }),
            wireMsg({
              id: "m2",
              seq: 2,
              content: retractedContent,
              retracted: true,
            }),
          ],
          hasMore: false,
        });
      }
      throw new Error(`Unexpected fetch #${index}: ${call.method} ${call.url}`);
    });

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    const messages = await client.readAllHistory(CHANNEL_ID);

    // 1) Exact token mint URL + secret auth + body
    expect(calls[0]).toMatchObject({
      url: "https://api.useportal.co/v1/tokens",
      method: "POST",
      headers: expect.objectContaining({
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
      }),
      body: {
        userId: `agent-${CHANNEL_ID}`,
        channels: {
          [CHANNEL_ID]: ["connect"],
        },
        ttl: "5m",
      },
    });

    // 2) First history page: limit=100, user JWT, no before
    expect(calls[1].url).toBe(
      `https://realtime.useportal.co/v1/channels/${encodeURIComponent(CHANNEL_ID)}/history?limit=100`,
    );
    expect(calls[1].method).toBe("GET");
    expect(calls[1].headers.Authorization).toBe(`Bearer ${USER_JWT}`);
    // Secret must never hit realtime
    expect(calls[1].headers.Authorization).not.toContain(SECRET);

    // 3) Second page: before = first sequence number of previous page (3)
    expect(calls[2].url).toBe(
      `https://realtime.useportal.co/v1/channels/${encodeURIComponent(CHANNEL_ID)}/history?before=3&limit=100`,
    );
    expect(calls[2].headers.Authorization).toBe(`Bearer ${USER_JWT}`);

    // Ascending merge + retracted removed (m2 dropped)
    expect(messages.map((m) => m.id)).toEqual(["m1", "m3", "m4"]);
    expect(messages.map((m) => m.seq)).toEqual([1, 3, 4]);
    for (const msg of messages) {
      expect(msg.retracted).toBe(false);
      expect(msg.ephemeral).toBe(false);
      expect(msg.content).toBeTruthy();
    }
  });

  it("publishes agent events on the control plane with secret auth and exact body", async () => {
    const event = reassignedEvent();
    const { fetchFn, calls } = recordCalls(() =>
      jsonResponse({ id: "pub_1", seq: 99, timestamp: 1_700_000_001_000 }),
    );

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    const ack = await client.publishAgentEvent(CHANNEL_ID, event);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      `https://api.useportal.co/v1/channels/${encodeURIComponent(CHANNEL_ID)}/messages`,
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers).toMatchObject({
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    });
    expect(calls[0].body).toMatchObject({
      senderId: "agent-backup",
      type: "order.reassigned",
      kind: "text",
      content: event,
    });
    expect(ack).toEqual({
      id: "pub_1",
      seq: 99,
      timestamp: 1_700_000_001_000,
    });
  });

  it("encodes channel ids in path segments", async () => {
    const weirdChannel = "kitchen/demo?x=1";
    const { fetchFn, calls } = recordCalls((call, index) => {
      if (index === 0) {
        return jsonResponse({ token: USER_JWT, expiresAt: "2026-01-01T00:05:00.000Z" });
      }
      if (index === 1) {
        return jsonResponse({ msgs: [], hasMore: false });
      }
      if (call.url.includes("/messages")) {
        return jsonResponse({ id: "p", seq: 1, timestamp: 1 });
      }
      throw new Error(`Unexpected ${call.url}`);
    });

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    await client.readAllHistory(weirdChannel);
    await client.publishAgentEvent(weirdChannel, reassignedEvent());

    const encoded = encodeURIComponent(weirdChannel);
    expect(calls[1].url).toContain(`/v1/channels/${encoded}/history`);
    expect(calls[2].url).toContain(`/v1/channels/${encoded}/messages`);
  });

  it("throws a concise Error on non-OK responses", async () => {
    const { fetchFn } = recordCalls(() =>
      new Response(JSON.stringify({ code: "unauthorized" }), { status: 401 }),
    );

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    await expect(client.readAllHistory(CHANNEL_ID)).rejects.toThrow(Error);
  });

  it("throws when mint response is missing token", async () => {
    const { fetchFn } = recordCalls(() =>
      jsonResponse({ expiresAt: "2026-01-01T00:05:00.000Z" }),
    );

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    await expect(client.readAllHistory(CHANNEL_ID)).rejects.toThrow(Error);
  });

  it("stops paging when the newest page is empty", async () => {
    const { fetchFn, calls } = recordCalls((call, index) => {
      if (index === 0) {
        return jsonResponse({ token: USER_JWT, expiresAt: "2026-01-01T00:05:00.000Z" });
      }
      return jsonResponse({ msgs: [], hasMore: true });
    });

    const client = createPortalServerClient({
      secret: SECRET,
      fetch: fetchFn as typeof fetch,
    });

    const messages = await client.readAllHistory(CHANNEL_ID);
    expect(messages).toEqual([]);
    // mint + one history page only (empty msgs stops safely)
    expect(calls).toHaveLength(2);
  });
});
