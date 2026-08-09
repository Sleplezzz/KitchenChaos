import { createFileRoute } from "@tanstack/react-router";

export type RoomSearch = {
  displayName: string;
};

function validateRoomSearch(search: Record<string, unknown>): RoomSearch {
  const raw = search.displayName;
  const displayName = typeof raw === "string" ? raw.trim() : "";
  return { displayName };
}

export const Route = createFileRoute("/room/$roomId/$role")({
  validateSearch: validateRoomSearch,
  component: RoomRoleShell,
});

function RoomRoleShell() {
  const { roomId, role } = Route.useParams();
  const { displayName } = Route.useSearch();

  return (
    <main>
      <h1>
        Room {roomId} — {role}
      </h1>
      <p>Placeholder role shell. No Portal or kitchen state yet.</p>
      {displayName ? <p>Joined as {displayName}</p> : null}
    </main>
  );
}
