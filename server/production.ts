import type { Hono } from "hono";
import { createApp } from "./app";
import type { AppDeps } from "./contracts";
import { parseServerEnv } from "./env";
import { createPortalServerClient } from "./portal/client";
import { createModelClient } from "./ai/model";

/**
 * Build production AppDeps from a validated server env bag.
 * No network calls: portal and model clients construct lazily.
 */
export function createProductionDeps(
  env: NodeJS.ProcessEnv = process.env,
): AppDeps {
  const parsed = parseServerEnv(env);
  const modelEnv: NodeJS.ProcessEnv = {};
  if (parsed.AI_GATEWAY_API_KEY !== undefined && parsed.AI_MODEL !== undefined) {
    modelEnv.AI_GATEWAY_API_KEY = parsed.AI_GATEWAY_API_KEY;
    modelEnv.AI_MODEL = parsed.AI_MODEL;
  }

  return {
    portal: createPortalServerClient({ secret: parsed.PORTAL_SECRET }),
    model: createModelClient(modelEnv),
    webhookSecret: parsed.PORTAL_WEBHOOK_SECRET,
  };
}

/** Build a full Hono app (health + webhook) with production dependencies. */
export function createProductionApp(
  env: NodeJS.ProcessEnv = process.env,
): Hono {
  return createApp(createProductionDeps(env));
}

let cached: Hono | undefined;

/**
 * Lazy singleton for Start handlers.
 * Importing this module does not parse env or construct clients.
 */
export function getProductionApp(
  env: NodeJS.ProcessEnv = process.env,
): Hono {
  if (cached === undefined) {
    cached = createProductionApp(env);
  }
  return cached;
}
