import type { Hono } from "hono";

export function forwardToHono(app: Hono, request: Request): Response | Promise<Response> {
  return app.fetch(request);
}
