import type { ReactNode } from "react";
import type { HumanRole } from "../domain/projection";
import { useKitchenRoom } from "../portal/useKitchenRoom";
import { CookView } from "./CookView";
import { CustomerView } from "./CustomerView";
import { ManagerView } from "./ManagerView";
import { PresenceBar } from "./PresenceBar";

export type KitchenShellProps = {
  roomId: string;
  displayName: string;
  role: HumanRole;
};

/**
 * Room shell: mounts useKitchenRoom once, renders shared header and role body.
 */
export function KitchenShell({
  roomId,
  displayName,
  role,
}: KitchenShellProps) {
  const {
    projection,
    presence,
    me,
    status,
    sendOrder,
    markOrderReady,
    failPrincipal,
  } = useKitchenRoom({
    roomId,
    displayName,
    role,
  });

  let roleBody: ReactNode;
  if (role === "customer") {
    roleBody = (
      <CustomerView
        projection={projection}
        meId={me?.id}
        status={status}
        sendOrder={sendOrder}
      />
    );
  } else if (role === "cook") {
    roleBody = (
      <CookView
        projection={projection}
        meId={me?.id}
        status={status}
        markOrderReady={markOrderReady}
      />
    );
  } else {
    roleBody = (
      <ManagerView
        projection={projection}
        meId={me?.id}
        status={status}
        failPrincipal={failPrincipal}
      />
    );
  }

  return (
    <div className="kitchen-shell">
      <PresenceBar
        roomId={roomId}
        status={status}
        presence={presence}
        agents={projection.agents}
        meId={me?.id}
      />
      <main className="kitchen-role-body">{roleBody}</main>
    </div>
  );
}
