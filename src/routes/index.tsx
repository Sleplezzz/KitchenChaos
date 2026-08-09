import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: JoinShell,
});

function JoinShell() {
  return (
    <main>
      <h1>Kitchen Chaos — join</h1>
      <p>Placeholder join shell. Portal wiring comes later.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div>
          <label htmlFor="room-code">Room code</label>
          <input id="room-code" name="roomCode" type="text" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" name="displayName" type="text" autoComplete="off" />
        </div>
        <button type="submit" disabled>
          Join (placeholder)
        </button>
      </form>
    </main>
  );
}
