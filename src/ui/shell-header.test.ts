import { describe, expect, it } from "vitest";
import { createEmptyProjection } from "../domain/projection";
import {
  formatConnectionLabel,
  formatRoomCode,
  parseRoomEntry,
  selectLatestAgentSentences,
  selectPresenceView,
} from "./shell-header";

describe("formatRoomCode", () => {
  it("strips the kitchen- prefix for display", () => {
    expect(formatRoomCode("kitchen-abc42")).toBe("abc42");
    expect(formatRoomCode("kitchen-demo")).toBe("demo");
  });

  it("leaves non-prefix room ids as-is", () => {
    expect(formatRoomCode("demo")).toBe("demo");
    expect(formatRoomCode("kitchen")).toBe("kitchen");
  });
});

describe("formatConnectionLabel", () => {
  it("maps every Portal connection status to a short label", () => {
    expect(formatConnectionLabel("ready")).toBe("Connected");
    expect(formatConnectionLabel("connecting")).toBe("Connecting…");
    expect(formatConnectionLabel("reconnecting")).toBe("Connecting…");
    expect(formatConnectionLabel("degraded")).toBe("Degraded");
    expect(formatConnectionLabel("degraded-http")).toBe("Degraded");
    expect(formatConnectionLabel("blocked")).toBe("Blocked");
    expect(formatConnectionLabel("idle")).toBe("Idle");
  });

  it("returns a non-empty label for unknown status strings", () => {
    expect(formatConnectionLabel("mystery")).toBeTruthy();
  });
});

describe("selectPresenceView", () => {
  it("converts detailed presence metadata to display rows", () => {
    expect(
      selectPresenceView({
        kind: "detailed",
        count: 2,
        participants: [
          {
            id: "u1",
            anon: true,
            metadata: { displayName: "Ada", role: "customer" },
          },
          {
            id: "u2",
            anon: true,
            metadata: { displayName: "Bob", role: "cook" },
          },
        ],
      }),
    ).toEqual({
      mode: "detailed",
      count: 2,
      people: [
        { id: "u1", displayName: "Ada", role: "customer", isSelf: false },
        { id: "u2", displayName: "Bob", role: "cook", isSelf: false },
      ],
    });
  });

  it("uses safe fallbacks when detailed metadata is missing", () => {
    expect(
      selectPresenceView({
        kind: "detailed",
        count: 2,
        participants: [
          { id: "u1", anon: true, metadata: {} },
          { id: "u2", anon: true, username: "chef" },
        ],
      }),
    ).toEqual({
      mode: "detailed",
      count: 2,
      people: [
        { id: "u1", displayName: "Guest", role: "?", isSelf: false },
        { id: "u2", displayName: "chef", role: "?", isSelf: false },
      ],
    });
  });

  it("returns aggregate count without participant rows", () => {
    expect(
      selectPresenceView({
        kind: "aggregate",
        count: 42,
        recent: [{ id: "u1", action: "join", at: 1 }],
      }),
    ).toEqual({ mode: "aggregate", count: 42 });
  });

  it("handles absent presence without a fake count", () => {
    expect(selectPresenceView(undefined)).toEqual({
      mode: "unknown",
      count: 0,
    });
    expect(selectPresenceView(null)).toEqual({ mode: "unknown", count: 0 });
  });

  it("marks the current participant with isSelf when meId matches", () => {
    expect(
      selectPresenceView(
        {
          kind: "detailed",
          count: 2,
          participants: [
            {
              id: "u1",
              anon: true,
              metadata: { displayName: "Ada", role: "customer" },
            },
            {
              id: "u2",
              anon: true,
              metadata: { displayName: "Bob", role: "cook" },
            },
          ],
        },
        "u1",
      ),
    ).toEqual({
      mode: "detailed",
      count: 2,
      people: [
        { id: "u1", displayName: "Ada", role: "customer", isSelf: true },
        { id: "u2", displayName: "Bob", role: "cook", isSelf: false },
      ],
    });
  });
});

describe("selectLatestAgentSentences", () => {
  it("returns one thought for each non-null agent role in fixed order", () => {
    const agents = createEmptyProjection("kitchen-demo").agents;
    agents.coordinator = {
      thought: "Assigned to keep the line moving",
      lastActionKey: "t:coordinator:assign:o1",
      updatedSeq: 1,
    };
    agents.backup = {
      thought: "Principal down; moving order to reserve",
      lastActionKey: "t:backup:reassign:o1",
      updatedSeq: 2,
    };
    agents.delivery = {
      thought: "Order ready; out for delivery",
      lastActionKey: "t:delivery:deliver:o1",
      updatedSeq: 3,
    };

    expect(selectLatestAgentSentences(agents)).toEqual([
      { role: "coordinator", sentence: "Assigned to keep the line moving" },
      {
        role: "backup",
        sentence: "Principal down; moving order to reserve",
      },
      { role: "delivery", sentence: "Order ready; out for delivery" },
    ]);
  });

  it("omits null agent roles instead of blank sentences", () => {
    const agents = createEmptyProjection("kitchen-demo").agents;
    agents.coordinator = {
      thought: "Only coordinator active",
      lastActionKey: "t:coordinator:assign:o1",
      updatedSeq: 1,
    };

    expect(selectLatestAgentSentences(agents)).toEqual([
      { role: "coordinator", sentence: "Only coordinator active" },
    ]);
  });
});

describe("parseRoomEntry", () => {
  it("accepts the committed join handoff", () => {
    expect(
      parseRoomEntry({
        roomId: "kitchen-demo",
        role: "customer",
        displayName: "  Ada  ",
      }),
    ).toEqual({
      ok: true,
      value: {
        roomId: "kitchen-demo",
        role: "customer",
        displayName: "Ada",
      },
    });
  });

  it("accepts each valid human role", () => {
    for (const role of ["customer", "cook", "manager"] as const) {
      expect(
        parseRoomEntry({
          roomId: "kitchen-abc42",
          role,
          displayName: "Ada",
        }),
      ).toEqual({
        ok: true,
        value: {
          roomId: "kitchen-abc42",
          role,
          displayName: "Ada",
        },
      });
    }
  });

  it("rejects an invalid room ID", () => {
    expect(
      parseRoomEntry({
        roomId: "demo",
        role: "customer",
        displayName: "Ada",
      }).ok,
    ).toBe(false);
    expect(
      parseRoomEntry({
        roomId: "kitchen-ab",
        role: "customer",
        displayName: "Ada",
      }).ok,
    ).toBe(false);
  });

  it("rejects an invalid role", () => {
    expect(
      parseRoomEntry({
        roomId: "kitchen-demo",
        role: "admin",
        displayName: "Ada",
      }).ok,
    ).toBe(false);
  });

  it("rejects a blank display name", () => {
    expect(
      parseRoomEntry({
        roomId: "kitchen-demo",
        role: "cook",
        displayName: "   ",
      }).ok,
    ).toBe(false);
  });
});
