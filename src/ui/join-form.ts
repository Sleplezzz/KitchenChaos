import type { HumanRole } from "../domain/projection";
import { toRoomId } from "../portal/room";

export type JoinFormInput = {
  displayName: string;
  roomCode: string;
  role: string;
};

export type JoinIntent = {
  displayName: string;
  roomId: string;
  role: HumanRole;
};

export type JoinFormErrors = {
  displayName?: string;
  roomCode?: string;
  role?: string;
};

export type ParseJoinFormResult =
  | { ok: true; value: JoinIntent }
  | { ok: false; errors: JoinFormErrors };

export type JoinErrorField = "displayName" | "roomCode" | "role";

export type FieldErrorAssociation = {
  errorId: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

const ERROR_IDS: Record<JoinErrorField, string> = {
  displayName: "join-display-name-error",
  roomCode: "join-room-code-error",
  role: "join-role-error",
};

/** Stable error id plus aria-invalid / aria-describedby for a join field. */
export function fieldErrorAssociation(
  field: JoinErrorField,
  message: string | undefined,
): FieldErrorAssociation {
  const errorId = ERROR_IDS[field];
  if (message) {
    return {
      errorId,
      "aria-invalid": true,
      "aria-describedby": errorId,
    };
  }
  return {
    errorId,
    "aria-invalid": false,
  };
}

const HUMAN_ROLES: readonly HumanRole[] = ["customer", "cook", "manager"];

function isHumanRole(value: string): value is HumanRole {
  return (HUMAN_ROLES as readonly string[]).includes(value);
}

export function parseJoinForm(input: JoinFormInput): ParseJoinFormResult {
  const errors: JoinFormErrors = {};
  const displayName = input.displayName.trim();

  if (!displayName) {
    errors.displayName = "Display name is required.";
  }

  if (!isHumanRole(input.role)) {
    errors.role = "Choose customer, cook, or manager.";
  }

  let roomId: string | undefined;
  try {
    roomId = toRoomId(input.roomCode);
  } catch {
    errors.roomCode =
      "Room code must yield 4–12 letters or digits after normalization.";
  }

  if (errors.displayName || errors.roomCode || errors.role) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      displayName,
      roomId: roomId!,
      role: input.role as HumanRole,
    },
  };
}
