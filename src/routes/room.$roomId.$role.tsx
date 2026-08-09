import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/room/$roomId/$role")({
  component: RoomRoleShell,
});

function RoomRoleShell() {
  const { roomId, role } = Route.useParams();

  return (
    <main>
      <h1>
        Room {roomId} — {role}
      </h1>
      <p>Placeholder role shell. No Portal or kitchen state yet.</p>
    </main>
  );
}
