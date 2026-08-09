import { Hono } from "hono";
import type { AppDeps } from "./contracts";

export type { AppDeps } from "./contracts";

function mountHealthRoutes(app: Hono): void {
  app.get("/api/health", (c) => c.json({ ok: true }));
}

/** Production DI factory. Callers supply real portal/model when wiring full routes. */
export function createApp(deps: AppDeps): Hono {
  void deps;
  const app = new Hono();
  mountHealthRoutes(app);
  return app;
}

/** Current health-only app. No fake Portal or model dependencies. */
export const honoApp = new Hono();
mountHealthRoutes(honoApp);
