import type { KitchenProjection, Order } from "./projection";

/** Received orders, earlier createdSeq first, for Cook's read-only Incoming list. */
export function selectCookIncomingOrders(
  state: KitchenProjection,
): Order[] {
  return Object.values(state.orders)
    .filter((order) => order.stage === "received")
    .sort((a, b) => a.createdSeq - b.createdSeq);
}

/** Cooking orders, higher priority first, then earlier createdSeq. */
export function selectCookQueue(state: KitchenProjection): Order[] {
  return Object.values(state.orders)
    .filter((order) => order.stage === "cooking")
    .sort((a, b) => {
      const priorityA = a.priorityScore ?? 0;
      const priorityB = b.priorityScore ?? 0;
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      return a.createdSeq - b.createdSeq;
    });
}

/** One customer's orders in stable creation order (createdSeq ascending). */
export function selectCustomerOrders(
  state: KitchenProjection,
  customerId: string,
): Order[] {
  return Object.values(state.orders)
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => a.createdSeq - b.createdSeq);
}

/** Active (non-delivered) orders currently assigned to Principal. */
export function selectAffectedPrincipalOrders(
  state: KitchenProjection,
): Order[] {
  return Object.values(state.orders).filter(
    (order) =>
      order.station === "principal" && order.stage !== "delivered",
  );
}
