import { useState } from "react";
import type { ChannelStatus } from "@portalsdk/core";
import { MENU } from "../domain/menu";
import type {
  KitchenProjection,
  Order,
  OrderStage,
  StationId,
} from "../domain/projection";
import {
  formatPriority,
  isPrincipalChaosControlEnabled,
  principalChaosDisabledReason,
  selectManagerBoard,
} from "./role-views";

export type ManagerViewProps = {
  projection: KitchenProjection;
  meId?: string;
  status: ChannelStatus | string;
  failPrincipal: () => Promise<void>;
};

const STAGE_LABELS: Record<OrderStage, string> = {
  received: "Received",
  cooking: "Cooking",
  ready: "Ready",
  delivered: "Delivered",
};

const STAGE_ORDER: readonly OrderStage[] = [
  "received",
  "cooking",
  "ready",
  "delivered",
];

function menuItemName(menuItemId: string): string {
  return MENU.find((item) => item.id === menuItemId)?.name ?? menuItemId;
}

function StageColumn({
  stage,
  orders,
}: {
  stage: OrderStage;
  orders: Order[];
}) {
  return (
    <section className="board-column" aria-label={STAGE_LABELS[stage]}>
      <h3 className="role-section-title">
        {STAGE_LABELS[stage]}
        <span className="board-count"> ({orders.length})</span>
      </h3>
      {orders.length === 0 ? (
        <p className="role-empty">None</p>
      ) : (
        <ul className="ticket-list">
          {orders.map((order) => {
            const priorityLabel = formatPriority(order.priorityScore);
            return (
              <li key={order.id} className="ticket">
                <div className="ticket-header">
                  <span className="ticket-id">{order.id.slice(0, 8)}</span>
                  <span className="ticket-stage">{order.stage}</span>
                  {order.station ? (
                    <span className="ticket-station">{order.station}</span>
                  ) : null}
                  {priorityLabel ? (
                    <span className="priority-badge">{priorityLabel}</span>
                  ) : null}
                </div>
                <p className="ticket-customer">{order.customerName}</p>
                <ul className="ticket-items">
                  {order.items.map((line) => (
                    <li key={line.menuItemId}>
                      {menuItemName(line.menuItemId)} × {line.quantity}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StationStatusRow({
  station,
  status,
}: {
  station: StationId;
  status: string;
}) {
  return (
    <li className="station-status-row">
      <span className="station-status-name">{station}</span>
      <span className="station-status-value" data-status={status}>
        {status}
      </span>
    </li>
  );
}

export function ManagerView({
  projection,
  meId,
  status,
  failPrincipal,
}: ManagerViewProps) {
  const [pending, setPending] = useState(false);
  /** Held after a successful publish until projection shows principal failed. */
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const board = selectManagerBoard(projection);
  const portalReady = status === "ready" && Boolean(meId);
  // Clear the post-success hold once projection has applied the failure.
  const submittedAwaitingProjection =
    submitted && board.stations.principal === "ok";

  const controlInput = {
    stations: board.stations,
    portalReady,
    pending,
    submitted: submittedAwaitingProjection,
  };
  const canFail = isPrincipalChaosControlEnabled(controlInput);
  const disabledReason = principalChaosDisabledReason(controlInput);

  async function onFailPrincipal() {
    if (!canFail) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await failPrincipal();
      // Keep control disabled until projection reflects principal failed.
      setSubmitted(true);
    } catch (cause) {
      // Rejected publish: allow retry.
      setSubmitted(false);
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not fail principal station.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="role-view manager-view" aria-label="Manager">
      <h2 className="role-view-title">Operations board</h2>

      <section className="station-status-panel" aria-label="Stations">
        <h3 className="role-section-title">Stations</h3>
        <ul className="station-status-list">
          <StationStatusRow
            station="principal"
            status={board.stations.principal}
          />
          <StationStatusRow
            station="reserve"
            status={board.stations.reserve}
          />
        </ul>

        <div className="chaos-control">
          <button
            type="button"
            className="role-action role-action-chaos"
            disabled={!canFail}
            aria-busy={pending}
            onClick={() => void onFailPrincipal()}
          >
            {pending ? "Failing Principal…" : "Fail Principal"}
          </button>
          {disabledReason ? (
            <p className="role-disabled-reason">{disabledReason}</p>
          ) : null}
          {error ? (
            <p className="role-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <div className="manager-board">
        {STAGE_ORDER.map((stage) => (
          <StageColumn key={stage} stage={stage} orders={board[stage]} />
        ))}
      </div>
    </section>
  );
}
