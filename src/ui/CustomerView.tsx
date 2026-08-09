import { useState, type FormEvent } from "react";
import type { ChannelStatus } from "@portalsdk/core";
import { MENU } from "../domain/menu";
import type {
  KitchenProjection,
  OrderItem,
} from "../domain/projection";
import {
  buildCustomerOrderItems,
  clampQuantity,
  emptyQuantityDraft,
  selectCustomerOrderRows,
  type QuantityDraft,
} from "./role-views";

export type CustomerViewProps = {
  projection: KitchenProjection;
  meId?: string;
  status: ChannelStatus | string;
  sendOrder: (items: OrderItem[]) => Promise<void>;
};

function menuItemName(menuItemId: string): string {
  return MENU.find((item) => item.id === menuItemId)?.name ?? menuItemId;
}

export function CustomerView({
  projection,
  meId,
  status,
  sendOrder,
}: CustomerViewProps) {
  const [quantities, setQuantities] = useState<QuantityDraft>(emptyQuantityDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portalReady = status === "ready" && Boolean(meId);
  const buildResult = buildCustomerOrderItems(quantities);
  const canSubmit = portalReady && buildResult.ok && !pending;

  const orderRows = meId
    ? selectCustomerOrderRows(projection, meId)
    : [];

  function adjustQuantity(
    menuItemId: keyof QuantityDraft,
    delta: number,
  ) {
    setQuantities((current) => ({
      ...current,
      [menuItemId]: clampQuantity(current[menuItemId] + delta),
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !buildResult.ok) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await sendOrder(buildResult.value);
      setQuantities(emptyQuantityDraft());
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not send order.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="role-view customer-view" aria-label="Customer">
      <h2 className="role-view-title">Customer</h2>

      <form className="role-form" onSubmit={onSubmit} noValidate>
        <h3 className="role-section-title">Menu</h3>
        <ul className="menu-list">
          {MENU.map((item) => {
            const quantity = quantities[item.id];
            const qtyId = `qty-${item.id}`;
            return (
              <li key={item.id} className="menu-row">
                <span className="menu-row-name" id={`${qtyId}-label`}>
                  {item.name}
                </span>
                <div className="qty-controls" role="group" aria-labelledby={`${qtyId}-label`}>
                  <button
                    type="button"
                    className="qty-button"
                    aria-label={`Decrease ${item.name}`}
                    disabled={quantity <= 0 || pending}
                    onClick={() => adjustQuantity(item.id, -1)}
                  >
                    −
                  </button>
                  <span className="qty-value" id={qtyId} aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="qty-button"
                    aria-label={`Increase ${item.name}`}
                    disabled={quantity >= 3 || pending}
                    onClick={() => adjustQuantity(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="submit"
          className="role-action"
          disabled={!canSubmit}
          aria-busy={pending}
        >
          {pending ? "Sending…" : "Send order"}
        </button>

        {error ? (
          <p className="role-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <section className="order-list-section" aria-label="Your orders">
        <h3 className="role-section-title">Your orders</h3>
        {orderRows.length === 0 ? (
          <p className="role-empty">No orders yet.</p>
        ) : (
          <ul className="ticket-list">
            {orderRows.map((order) => (
              <li key={order.id} className="ticket">
                <div className="ticket-header">
                  <span className="ticket-id">{order.id.slice(0, 8)}</span>
                  <span className="ticket-stage">{order.stage}</span>
                  {order.station ? (
                    <span className="ticket-station">{order.station}</span>
                  ) : null}
                  {order.priorityLabel ? (
                    <span className="priority-badge">{order.priorityLabel}</span>
                  ) : null}
                </div>
                <ul className="ticket-items">
                  {order.items.map((line) => (
                    <li key={line.menuItemId}>
                      {menuItemName(line.menuItemId)} × {line.quantity}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
