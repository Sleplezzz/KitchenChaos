import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { HumanRole } from "../domain/projection";
import {
  fieldErrorAssociation,
  parseJoinForm,
  type JoinFormErrors,
} from "./join-form";

const ROLES: readonly HumanRole[] = ["customer", "cook", "manager"];

export function JoinScreen() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [role, setRole] = useState<HumanRole | "">("");
  const [errors, setErrors] = useState<JoinFormErrors>({});

  const displayNameError = fieldErrorAssociation(
    "displayName",
    errors.displayName,
  );
  const roomCodeError = fieldErrorAssociation("roomCode", errors.roomCode);
  const roleError = fieldErrorAssociation("role", errors.role);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseJoinForm({ displayName, roomCode, role });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    void navigate({
      to: "/room/$roomId/$role",
      params: {
        roomId: result.value.roomId,
        role: result.value.role,
      },
      search: {
        displayName: result.value.displayName,
      },
    });
  }

  return (
    <main className="join-page">
      <form className="join-card" onSubmit={onSubmit} noValidate>
        <p className="join-eyebrow">JOIN ROOM</p>
        <h1 className="join-title">Kitchen Chaos</h1>

        <div className="join-field">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            name="displayName"
            type="text"
            autoComplete="off"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-invalid={displayNameError["aria-invalid"]}
            aria-describedby={displayNameError["aria-describedby"]}
          />
          {errors.displayName ? (
            <p
              id={displayNameError.errorId}
              className="join-error"
              role="alert"
            >
              {errors.displayName}
            </p>
          ) : null}
        </div>

        <div className="join-field">
          <label htmlFor="room-code">Room code</label>
          <input
            id="room-code"
            name="roomCode"
            type="text"
            autoComplete="off"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            aria-invalid={roomCodeError["aria-invalid"]}
            aria-describedby={roomCodeError["aria-describedby"]}
          />
          {errors.roomCode ? (
            <p id={roomCodeError.errorId} className="join-error" role="alert">
              {errors.roomCode}
            </p>
          ) : null}
        </div>

        <fieldset
          className="join-field join-roles"
          aria-invalid={roleError["aria-invalid"]}
          aria-describedby={roleError["aria-describedby"]}
        >
          <legend>Role</legend>
          <div className="join-role-chips">
            {ROLES.map((option) => {
              const selected = role === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={
                    selected ? "join-role-chip is-selected" : "join-role-chip"
                  }
                  aria-pressed={selected}
                  onClick={() => setRole(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {errors.role ? (
            <p id={roleError.errorId} className="join-error" role="alert">
              {errors.role}
            </p>
          ) : null}
        </fieldset>

        <button type="submit" className="join-submit">
          Join room
        </button>
      </form>
    </main>
  );
}
