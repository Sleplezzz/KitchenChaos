import { Link, createFileRoute } from "@tanstack/react-router";
import { KitchenShell } from "../ui/KitchenShell";
import { parseRoomEntry } from "../ui/shell-header";

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
  const entry = parseRoomEntry({ roomId, role, displayName });

  if (!entry.ok) {
    return (
      <main className="room-invalid">
        <p className="room-invalid-title">Invalid room link</p>
        <p className="room-invalid-body">
          Room id, role, or display name is missing or invalid.
        </p>
        <Link to="/" className="room-invalid-link">
          Return to join
        </Link>
      </main>
    );
  }

  return (
    <KitchenShell
      roomId={entry.value.roomId}
      role={entry.value.role}
      displayName={entry.value.displayName}
    />
  );
}
