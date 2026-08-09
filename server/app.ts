import { Hono } from "hono";

export type AppDeps = {};

export function createApp(deps: AppDeps): Hono {
  void deps;
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true }));

  return app;
}

export const honoApp = createApp({});
