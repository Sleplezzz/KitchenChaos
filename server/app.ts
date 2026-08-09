import { Hono } from "hono";
import { humanKitchenEventSchema } from "../src/domain/events";
import type { AppDeps } from "./contracts";
import { portalDeliverySchema } from "./contracts";
import {
  deliveryDataToTrigger,
  OrchestratorError,
  orchestrateHumanEvent,
} from "./orchestrator";
import {
  verifyPortalWebhook,
  WebhookVerificationError,
} from "./portal/verify-webhook";

export type { AppDeps } from "./contracts";

function mountHealthRoutes(app: Hono): void {
  app.get("/api/health", (c) => c.json({ ok: true }));
}

function mountWebhookRoute(app: Hono, deps: AppDeps): void {
  app.post("/api/portal/webhook", async (c) => {
    const rawBody = await c.req.text();

    try {
      verifyPortalWebhook({
        rawBody,
        signatureHeader: c.req.header("portal-signature"),
        secret: deps.webhookSecret,
        nowMs: (deps.now ?? Date.now)(),
      });
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return c.json({ ok: false }, 401);
      }
      throw err;
    }

    let delivery;
    try {
      const parsed = portalDeliverySchema.safeParse(JSON.parse(rawBody));
      if (!parsed.success) {
        return c.json({ ok: true, ignored: true });
      }
      delivery = parsed.data;
    } catch {
      return c.json({ ok: true, ignored: true });
    }

    if (delivery.type !== "message.published" || delivery.data.retracted) {
      return c.json({ ok: true, ignored: true });
    }

    const human = humanKitchenEventSchema.safeParse(delivery.data.content);
    if (!human.success) {
      return c.json({ ok: true, ignored: true });
    }

    try {
      const result = await orchestrateHumanEvent({
        channelId: delivery.channelId,
        trigger: deliveryDataToTrigger(delivery.data),
        event: human.data,
        portal: deps.portal,
        model: deps.model,
      });
      return c.json({ ok: true, published: result.published });
    } catch (err) {
      if (err instanceof OrchestratorError) {
        if (err.code === "portal_publish") {
          return c.json({ ok: false }, 502);
        }
        if (err.code === "insufficient_history") {
          return c.json({ ok: false }, 503);
        }
      }
      throw err;
    }
  });
}

/** Production DI factory. Callers supply real portal/model when wiring full routes. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  mountHealthRoutes(app);
  mountWebhookRoute(app, deps);
  return app;
}

/** Current health-only app. No fake Portal or model dependencies. */
export const honoApp = new Hono();
mountHealthRoutes(honoApp);
