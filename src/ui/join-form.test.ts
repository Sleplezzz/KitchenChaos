import { describe, expect, it } from "vitest";
import { fieldErrorAssociation, parseJoinForm } from "./join-form";

describe("fieldErrorAssociation", () => {
  it("returns stable error id, aria-invalid, and aria-describedby when invalid", () => {
    expect(fieldErrorAssociation("displayName", "Display name is required.")).toEqual({
      errorId: "join-display-name-error",
      "aria-invalid": true,
      "aria-describedby": "join-display-name-error",
    });
    expect(
      fieldErrorAssociation(
        "roomCode",
        "Room code must yield 4–12 letters or digits after normalization.",
      ),
    ).toEqual({
      errorId: "join-room-code-error",
      "aria-invalid": true,
      "aria-describedby": "join-room-code-error",
    });
    expect(
      fieldErrorAssociation("role", "Choose customer, cook, or manager."),
    ).toEqual({
      errorId: "join-role-error",
      "aria-invalid": true,
      "aria-describedby": "join-role-error",
    });
  });

  it("keeps the stable error id and clears association when valid", () => {
    expect(fieldErrorAssociation("displayName", undefined)).toEqual({
      errorId: "join-display-name-error",
      "aria-invalid": false,
    });
    expect(fieldErrorAssociation("roomCode", undefined)).toEqual({
      errorId: "join-room-code-error",
      "aria-invalid": false,
    });
    expect(fieldErrorAssociation("role", undefined)).toEqual({
      errorId: "join-role-error",
      "aria-invalid": false,
    });
  });
});

describe("parseJoinForm", () => {
  it("accepts name, room code, and human role into a join intent", () => {
    expect(
      parseJoinForm({
        displayName: "  Ada  ",
        roomCode: "  ABC-42 ",
        role: "customer",
      }),
    ).toEqual({
      ok: true,
      value: {
        displayName: "Ada",
        roomId: "kitchen-abc42",
        role: "customer",
      },
    });
  });

  it("accepts each valid human role", () => {
    for (const role of ["customer", "cook", "manager"] as const) {
      const result = parseJoinForm({
        displayName: "Ada",
        roomCode: "demo",
        role,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          displayName: "Ada",
          roomId: "kitchen-demo",
          role,
        },
      });
    }
  });

  it("rejects a blank display name", () => {
    expect(
      parseJoinForm({
        displayName: "   ",
        roomCode: "demo",
        role: "customer",
      }),
    ).toEqual({
      ok: false,
      errors: { displayName: "Display name is required." },
    });
  });

  it("returns a form error for an invalid room code", () => {
    expect(
      parseJoinForm({
        displayName: "Ada",
        roomCode: "ab",
        role: "cook",
      }),
    ).toEqual({
      ok: false,
      errors: {
        roomCode:
          "Room code must yield 4–12 letters or digits after normalization.",
      },
    });
  });

  it("rejects an unknown role", () => {
    expect(
      parseJoinForm({
        displayName: "Ada",
        roomCode: "demo",
        role: "admin",
      }),
    ).toEqual({
      ok: false,
      errors: { role: "Choose customer, cook, or manager." },
    });
  });
});
