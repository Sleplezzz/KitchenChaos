import type { z } from "zod";
import type { AgentKitchenEvent } from "../src/domain/events";
import type { PortalMessageLike } from "../src/domain/projection";

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
