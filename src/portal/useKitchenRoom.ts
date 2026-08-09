import { useChannel } from "@portalsdk/react";
import { useCallback, useEffect, useMemo } from "react";
import type { KitchenEventContent } from "../domain/events";
import type { HumanRole, OrderItem } from "../domain/projection";
import { selectAffectedPrincipalOrders } from "../domain/selectors";
import {
  buildOrderCreated,
  buildOrderReady,
  buildStationFailed,
  projectPortalMessages,
} from "./messages";

export type UseKitchenRoomParams = {
  roomId: string;
  displayName: string;
  role: HumanRole;
};

/**
 * Join one kitchen Portal channel: project history, presence, and human publishes.
 */
export function useKitchenRoom({
  roomId,
  displayName,
  role,
}: UseKitchenRoomParams) {
  const {
    messages,
    send,
    loadPrevious,
    isLoadingPrevious,
    hasPrevious,
    presence,
    me,
    status,
    setMetadata,
  } = useChannel<KitchenEventContent>({
    channelId: roomId,
    history: 100,
    metadata: { displayName, role },
  });

  useEffect(() => {
    if (status === "ready" && hasPrevious && !isLoadingPrevious) {
      void loadPrevious();
    }
  }, [status, hasPrevious, isLoadingPrevious, loadPrevious]);

  useEffect(() => {
    setMetadata({ displayName, role });
  }, [displayName, role, setMetadata]);

  const projection = useMemo(
    () => projectPortalMessages(roomId, messages),
    [roomId, messages],
  );

  const sendOrder = useCallback(
    async (items: OrderItem[]) => {
      if (!me) {
        throw new Error("Cannot publish before channel identity is ready");
      }

      const event = buildOrderCreated({
        roomId,
        customerId: me.id,
        customerName: displayName,
        items,
        orderId: crypto.randomUUID(),
      });

      await send({ type: event.type, kind: "text", content: event });
    },
    [displayName, me, roomId, send],
  );

  const markOrderReady = useCallback(
    async (orderId: string) => {
      if (!me) {
        throw new Error("Cannot publish before channel identity is ready");
      }

      const event = buildOrderReady({
        roomId,
        cookId: me.id,
        orderId,
      });

      await send({ type: event.type, kind: "text", content: event });
    },
    [me, roomId, send],
  );

  const failPrincipal = useCallback(async () => {
    if (!me) {
      throw new Error("Cannot publish before channel identity is ready");
    }

    const affectedOrderIds = selectAffectedPrincipalOrders(projection).map(
      (order) => order.id,
    );

    const event = buildStationFailed({
      roomId,
      managerId: me.id,
      affectedOrderIds,
      reserveStatus: projection.stations.reserve,
    });

    await send({ type: event.type, kind: "text", content: event });
  }, [me, projection, roomId, send]);

  return {
    projection,
    presence,
    me,
    status,
    sendOrder,
    markOrderReady,
    failPrincipal,
  };
}
