import type { ChannelStatus } from "@portalsdk/core";
import type {
  AgentRole,
  HumanRole,
  KitchenProjection,
} from "../domain/projection";

export type PresenceParticipantInput = {
  id: string;
  anon: boolean;
  username?: string;
  metadata?: Record<string, unknown>;
};

export type DetailedPresenceInput = {
  kind: "detailed";
  participants: PresenceParticipantInput[];
  count: number;
};

export type AggregatePresenceInput = {
  kind: "aggregate";
  count: number;
  recent?: {
    id: string;
    action: "join" | "leave";
    at: number;
  }[];
};

export type PresenceInput =
  | DetailedPresenceInput
  | AggregatePresenceInput
  | null
  | undefined;

export type PresencePerson = {
  id: string;
  displayName: string;
  role: string;
  isSelf: boolean;
};

export type PresenceView =
  | { mode: "detailed"; people: PresencePerson[]; count: number }
  | { mode: "aggregate"; count: number }
  | { mode: "unknown"; count: 0 };

export type AgentSentence = {
  role: AgentRole;
  sentence: string;
};

export type RoomEntryInput = {
  roomId: string;
  role: string;
  displayName: string;
};

export type RoomEntry = {
  roomId: string;
  role: HumanRole;
  displayName: string;
};

export type ParseRoomEntryResult =
  | { ok: true; value: RoomEntry }
  | { ok: false; reason: "roomId" | "role" | "displayName" };

const ROOM_ID_PATTERN = /^kitchen-[a-z0-9]{4,12}$/;
const HUMAN_ROLES: readonly HumanRole[] = ["customer", "cook", "manager"];
const AGENT_ORDER: readonly AgentRole[] = [
  "coordinator",
  "backup",
  "delivery",
];

const CONNECTION_LABELS: Record<ChannelStatus, string> = {
  ready: "Connected",
  connecting: "Connecting…",
  reconnecting: "Connecting…",
  degraded: "Degraded",
  "degraded-http": "Degraded",
  blocked: "Blocked",
  idle: "Idle",
};

function isHumanRole(value: string): value is HumanRole {
  return (HUMAN_ROLES as readonly string[]).includes(value);
}

/** Strip the `kitchen-` prefix for human-readable room codes. */
export function formatRoomCode(roomId: string): string {
  return roomId.startsWith("kitchen-") ? roomId.slice("kitchen-".length) : roomId;
}

/** Map Portal connection status to a short UI label. */
export function formatConnectionLabel(status: ChannelStatus | string): string {
  if (status in CONNECTION_LABELS) {
    return CONNECTION_LABELS[status as ChannelStatus];
  }
  return "Unknown";
}

function readDisplayName(participant: PresenceParticipantInput): string {
  const meta = participant.metadata;
  const fromMeta = meta?.displayName;
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }
  if (typeof participant.username === "string" && participant.username.trim()) {
    return participant.username.trim();
  }
  return "Guest";
}

function readRole(participant: PresenceParticipantInput): string {
  const role = participant.metadata?.role;
  if (typeof role === "string" && isHumanRole(role)) {
    return role;
  }
  if (typeof role === "string" && role.trim()) {
    return role.trim();
  }
  return "?";
}

/** Convert Portal presence into header display data without inventing people. */
export function selectPresenceView(
  presence: PresenceInput,
  meId?: string,
): PresenceView {
  if (!presence) {
    return { mode: "unknown", count: 0 };
  }

  if (presence.kind === "aggregate") {
    return { mode: "aggregate", count: presence.count };
  }

  if (presence.kind === "detailed") {
    return {
      mode: "detailed",
      count: presence.count,
      people: presence.participants.map((participant) => ({
        id: participant.id,
        displayName: readDisplayName(participant),
        role: readRole(participant),
        isSelf: meId !== undefined && participant.id === meId,
      })),
    };
  }

  return { mode: "unknown", count: 0 };
}

/** One latest operational sentence per non-null agent role. */
export function selectLatestAgentSentences(
  agents: KitchenProjection["agents"],
): AgentSentence[] {
  const sentences: AgentSentence[] = [];
  for (const role of AGENT_ORDER) {
    const activity = agents[role];
    if (activity) {
      sentences.push({ role, sentence: activity.thought });
    }
  }
  return sentences;
}

/**
 * Validate deep-link room params before mounting the Portal channel hook.
 * Valid room IDs match `^kitchen-[a-z0-9]{4,12}$`.
 */
export function parseRoomEntry(input: RoomEntryInput): ParseRoomEntryResult {
  const displayName = input.displayName.trim();
  if (!displayName) {
    return { ok: false, reason: "displayName" };
  }

  if (!ROOM_ID_PATTERN.test(input.roomId)) {
    return { ok: false, reason: "roomId" };
  }

  if (!isHumanRole(input.role)) {
    return { ok: false, reason: "role" };
  }

  return {
    ok: true,
    value: {
      roomId: input.roomId,
      role: input.role,
      displayName,
    },
  };
}
