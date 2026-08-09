import type { HumanRole } from "../domain/projection";
import { useKitchenRoom } from "../portal/useKitchenRoom";
import { PresenceBar } from "./PresenceBar";

export type KitchenShellProps = {
  roomId: string;
  displayName: string;
  role: HumanRole;
};

/**
 * Room shell: mounts useKitchenRoom once, renders shared header, role body placeholder.
 */
export function KitchenShell({
  roomId,
  displayName,
  role,
}: KitchenShellProps) {
  const { projection, presence, me, status } = useKitchenRoom({
    roomId,
    displayName,
    role,
  });

  return (
    <div className="kitchen-shell">
      <PresenceBar
        roomId={roomId}
        status={status}
        presence={presence}
        agents={projection.agents}
        meId={me?.id}
      />
      <main className="kitchen-role-body">
        <p className="kitchen-role-placeholder">
          {role} view — coming next
        </p>
      </main>
    </div>
  );
}
