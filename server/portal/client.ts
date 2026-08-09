import type { AgentKitchenEvent } from "../../src/domain/events";
import type { PortalMessageLike } from "../../src/domain/projection";
import type { PortalServerClient } from "../contracts";

const CONTROL_PLANE = "https://api.useportal.co";
const REALTIME = "https://realtime.useportal.co";

export type CreatePortalServerClientOptions = {
  secret: string;
  fetch?: typeof globalThis.fetch;
};

type WireMessage = {
  id: string;
  seq: number | null;
  content: unknown;
  timestamp: number;
  retracted?: boolean;
  ephemeral?: boolean;
};

type HistoryResponse = {
  msgs: WireMessage[];
  hasMore: boolean;
};

type TokenResponse = {
  token?: string;
  expiresAt?: string;
};

type SendAck = {
  id: string;
  seq: number;
  timestamp: number;
};

function fail(message: string): never {
  throw new Error(message);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    fail(`Portal response was not valid JSON (${response.status})`);
  }
}

async function requireOk(response: Response, action: string): Promise<unknown> {
  if (!response.ok) {
    fail(`Portal ${action} failed (${response.status})`);
  }
  return parseJson(response);
}

function channelPath(channelId: string): string {
  return encodeURIComponent(channelId);
}

export function createPortalServerClient(
  options: CreatePortalServerClientOptions,
): PortalServerClient {
  const secret = options.secret;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  if (!secret) {
    fail("Portal secret is required");
  }

  async function mintHistoryToken(channelId: string): Promise<string> {
    const response = await fetchFn(`${CONTROL_PLANE}/v1/tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: `agent-${channelId}`,
        channels: {
          [channelId]: ["connect"],
        },
        ttl: "5m",
      }),
    });

    const body = (await requireOk(response, "token mint")) as TokenResponse;
    if (typeof body.token !== "string" || body.token.length === 0) {
      fail("Portal token mint response missing token");
    }
    return body.token;
  }

  async function readAllHistory(channelId: string): Promise<PortalMessageLike[]> {
    const token = await mintHistoryToken(channelId);
    const encoded = channelPath(channelId);
    const pages: WireMessage[][] = [];
    let before: number | undefined;

    for (;;) {
      const query =
        before === undefined
          ? "limit=100"
          : `before=${before}&limit=100`;

      const response = await fetchFn(
        `${REALTIME}/v1/channels/${encoded}/history?${query}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = (await requireOk(response, "history")) as HistoryResponse;
      const msgs = Array.isArray(body.msgs) ? body.msgs : fail("Portal history response missing msgs");

      if (msgs.length === 0) {
        break;
      }

      pages.unshift(msgs);
      const firstSeq = msgs[0]?.seq;
      if (typeof firstSeq !== "number") {
        fail("Portal history message missing seq");
      }

      if (body.hasMore !== true) {
        break;
      }

      before = firstSeq;
    }

    const merged = pages.flat();
    const result: PortalMessageLike[] = [];

    for (const msg of merged) {
      if (msg.retracted) {
        continue;
      }
      if (typeof msg.id !== "string" || typeof msg.seq !== "number") {
        fail("Portal history message missing required fields");
      }
      if (typeof msg.timestamp !== "number") {
        fail("Portal history message missing timestamp");
      }
      result.push({
        id: msg.id,
        seq: msg.seq,
        timestamp: msg.timestamp,
        retracted: false,
        ephemeral: false,
        content: msg.content,
      });
    }

    return result;
  }

  async function publishAgentEvent(
    channelId: string,
    event: AgentKitchenEvent,
  ): Promise<{ id: string; seq: number; timestamp: number }> {
    const encoded = channelPath(channelId);
    const response = await fetchFn(
      `${CONTROL_PLANE}/v1/channels/${encoded}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderId: `agent-${event.agentRole}`,
          type: event.type,
          kind: "text",
          content: event,
        }),
      },
    );

    const body = (await requireOk(response, "publish")) as Partial<SendAck>;
    if (
      typeof body.id !== "string" ||
      typeof body.seq !== "number" ||
      typeof body.timestamp !== "number"
    ) {
      fail("Portal publish response missing required fields");
    }

    return {
      id: body.id,
      seq: body.seq,
      timestamp: body.timestamp,
    };
  }

  return {
    readAllHistory,
    publishAgentEvent,
  };
}
