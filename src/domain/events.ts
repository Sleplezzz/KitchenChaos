import { z } from "zod";

export const priorityScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const contextHintSchema = z
  .object({
    stations: z.object({
      principal: z.enum(["ok", "failed"]),
      reserve: z.enum(["ok", "failed"]),
    }),
    affectedOrderIds: z.array(z.string().uuid()).max(30),
  })
  .strict();

const roomIdSchema = z
  .string()
  .regex(/^kitchen-[a-z0-9]{4,12}$/);

const menuItemIdSchema = z.enum([
  "smash-burger",
  "veggie-bowl",
  "loaded-fries",
]);

const orderLineItemSchema = z
  .object({
    menuItemId: menuItemIdSchema,
    quantity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

const orderItemsSchema = z.array(orderLineItemSchema).min(1).max(8);

const stationSchema = z.enum(["principal", "reserve"]);

const actorFields = {
  id: z.string().min(1),
  name: z.string().min(1).optional(),
};

const customerActorSchema = z
  .object({
    role: z.literal("customer"),
    ...actorFields,
  })
  .strict();

const cookActorSchema = z
  .object({
    role: z.literal("cook"),
    ...actorFields,
  })
  .strict();

const managerActorSchema = z
  .object({
    role: z.literal("manager"),
    ...actorFields,
  })
  .strict();

const agentActorSchema = z
  .object({
    role: z.literal("agent"),
    ...actorFields,
  })
  .strict();

const baseEventFields = {
  version: z.literal(1),
  roomId: roomIdSchema,
  contextHint: contextHintSchema.optional(),
};

const orderCreatedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("order.created"),
    actor: customerActorSchema,
    payload: z
      .object({
        orderId: z.string().uuid(),
        customerId: z.string().min(1),
        customerName: z.string().min(1),
        items: orderItemsSchema,
      })
      .strict(),
  })
  .strict();

const orderReadyEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("order.ready"),
    actor: cookActorSchema,
    payload: z
      .object({
        orderId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();

const stationFailedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("station.failed"),
    actor: managerActorSchema,
    payload: z
      .object({
        station: z.literal("principal"),
      })
      .strict(),
  })
  .strict();

const agentBaseFields = {
  ...baseEventFields,
  actor: agentActorSchema,
  causedBy: z.string().min(1),
  actionKey: z.string().min(1),
  thought: z.string().min(1).max(120),
};

const orderAssignedEventSchema = z
  .object({
    ...agentBaseFields,
    type: z.literal("order.assigned"),
    agentRole: z.literal("coordinator"),
    payload: z
      .object({
        orderId: z.string().uuid(),
        station: stationSchema,
        priorityScore: priorityScoreSchema,
      })
      .strict(),
  })
  .strict();

const orderReassignedEventSchema = z
  .object({
    ...agentBaseFields,
    type: z.literal("order.reassigned"),
    agentRole: z.literal("backup"),
    payload: z
      .object({
        orderId: z.string().uuid(),
        station: z.literal("reserve"),
        priorityScore: z.literal(3),
      })
      .strict(),
  })
  .strict();

const orderDeliveredEventSchema = z
  .object({
    ...agentBaseFields,
    type: z.literal("order.delivered"),
    agentRole: z.literal("delivery"),
    payload: z
      .object({
        orderId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();

export const humanKitchenEventSchema = z.discriminatedUnion("type", [
  orderCreatedEventSchema,
  orderReadyEventSchema,
  stationFailedEventSchema,
]);

export const agentKitchenEventSchema = z.discriminatedUnion("type", [
  orderAssignedEventSchema,
  orderReassignedEventSchema,
  orderDeliveredEventSchema,
]);

export const kitchenEventSchema = z.discriminatedUnion("type", [
  orderCreatedEventSchema,
  orderReadyEventSchema,
  stationFailedEventSchema,
  orderAssignedEventSchema,
  orderReassignedEventSchema,
  orderDeliveredEventSchema,
]);

export type ContextHint = z.infer<typeof contextHintSchema>;
export type HumanKitchenEvent = z.infer<typeof humanKitchenEventSchema>;
export type AgentKitchenEvent = z.infer<typeof agentKitchenEventSchema>;
export type KitchenEventContent = z.infer<typeof kitchenEventSchema>;

export function buildActionKey(input: {
  triggerId: string;
  agentRole: "coordinator" | "backup" | "delivery";
  actionType: "order.assigned" | "order.reassigned" | "order.delivered";
  orderId: string;
}): string {
  return `${input.triggerId}:${input.agentRole}:${input.actionType}:${input.orderId}`;
}
