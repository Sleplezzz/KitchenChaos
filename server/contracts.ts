import { z } from "zod";
import type { AgentKitchenEvent } from "../src/domain/events";
import type { PortalMessageLike } from "../src/domain/projection";

/** Wire sender on Portal persistent messages (`id`, `anon`, optional `username`). */
const portalSenderSchema = z.object({
  id: z.string(),
  anon: z.boolean(),
  username: z.string().optional(),
});

/**
 * Persistent message envelope delivered by Portal webhooks.
 * Ephemeral messages are never webhooked; `ephemeral` must be false.
 */
const portalPersistentMessageDataSchema = z.object({
  id: z.string(),
  seq: z.number(),
  content: z.unknown(),
  sender: portalSenderSchema,
  timestamp: z.number(),
  retracted: z.boolean(),
  ephemeral: z.literal(false),
});

/** Portal webhook delivery body for `message.published` | `message.retracted`. */
export const portalDeliverySchema = z.object({
  id: z.string(),
  type: z.enum(["message.published", "message.retracted"]),
  timestamp: z.number(),
  environmentId: z.string(),
  channelId: z.string(),
  data: portalPersistentMessageDataSchema,
});

export type PortalDelivery = z.infer<typeof portalDeliverySchema>;

export type PortalServerClient = {
  readAllHistory(channelId: string): Promise<PortalMessageLike[]>;
  publishAgentEvent(
    channelId: string,
    event: AgentKitchenEvent,
  ): Promise<{ id: string; seq: number; timestamp: number }>;
};

export type ModelClient = {
  generate<T>(input: {
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
  }): Promise<T>;
};

export type AppDeps = {
  portal: PortalServerClient;
  model: ModelClient | null;
  webhookSecret: string;
  now?: () => number;
};
