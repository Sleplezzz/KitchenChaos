import { useState } from "react";
import type { ChannelStatus } from "@portalsdk/core";
import { MENU } from "../domain/menu";
import type { KitchenProjection, Order } from "../domain/projection";
import { formatPriority, groupCookQueueByStation } from "./role-views";

export type CookViewProps = {
  projection: KitchenProjection;
  meId?: string;
  status: ChannelStatus | string;
  markOrderReady: (orderId: string) => Promise<void>;
};

function menuItemName(menuItemId: string): string {
  return MENU.find((item) => item.id === menuItemId)?.name ?? menuItemId;
}

function OrderTicket({
  order,
  suggested,
  pendingId,
  canAct,
  onReady,
}: {
  order: Order;
  suggested: boolean;
  pendingId: string | null;
  canAct: boolean;
  onReady: (orderId: string) => void;
}) {
  const priorityLabel = formatPriority(order.priorityScore);
  const busy = pendingId === order.id;

  return (
    <li
      className={suggested ? "ticket ticket-suggested" : "ticket"}
      data-suggested={suggested ? "true" : undefined}
    >
      <div className="ticket-header">
        <span className="ticket-id">{order.id.slice(0, 8)}</span>
        {suggested ? (
          <span className="ticket-suggest">Suggested next</span>
        ) : null}
        {order.station ? (
          <span className="ticket-station">{order.station}</span>
        ) : null}
        {priorityLabel ? (
          <span className="priority-badge">{priorityLabel}</span>
        ) : null}
      </div>
      <ul className="ticket-items">
        {order.items.map((line) => (
          <li key={line.menuItemId}>
            {menuItemName(line.menuItemId)} × {line.quantity}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="role-action role-action-ready"
        disabled={!canAct || pendingId !== null}
        aria-busy={busy}
        onClick={() => onReady(order.id)}
      >
        {busy ? "Marking…" : "Ready"}
      </button>
    </li>
  );
}

function StationGroup({
  label,
  orders,
  suggestedNextId,
  pendingId,
  canAct,
  onReady,
}: {
  label: string;
  orders: Order[];
  suggestedNextId: string | null;
  pendingId: string | null;
  canAct: boolean;
  onReady: (orderId: string) => void;
}) {
  return (
    <section className="station-group" aria-label={label}>
      <h3 className="role-section-title">{label}</h3>
      {orders.length === 0 ? (
        <p className="role-empty">No cooking orders.</p>
      ) : (
        <ul className="ticket-list">
          {orders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              suggested={order.id === suggestedNextId}
              pendingId={pendingId}
              canAct={canAct}
              onReady={onReady}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CookView({
  projection,
  meId,
  status,
  markOrderReady,
}: CookViewProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = groupCookQueueByStation(projection);
  const canAct = status === "ready" && Boolean(meId);

  async function onReady(orderId: string) {
    if (!canAct || pendingId !== null) {
      return;
    }

    setPendingId(orderId);
    setError(null);
    try {
      await markOrderReady(orderId);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not mark order ready.";
      setError(message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="role-view cook-view" aria-label="Cook">
      <h2 className="role-view-title">Cook queue</h2>

      {error ? (
        <p className="role-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="cook-stations">
        <StationGroup
          label="Principal"
          orders={groups.principal}
          suggestedNextId={groups.suggestedNextId}
          pendingId={pendingId}
          canAct={canAct}
          onReady={onReady}
        />
        <StationGroup
          label="Reserve"
          orders={groups.reserve}
          suggestedNextId={groups.suggestedNextId}
          pendingId={pendingId}
          canAct={canAct}
          onReady={onReady}
        />
      </div>
    </section>
  );
}
