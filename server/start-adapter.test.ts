import { describe, expect, it, vi } from "vitest";
import type { Hono } from "hono";
import { forwardToHono } from "./start-adapter";

describe("forwardToHono", () => {
  it("preserves the exact Request and Response objects without reading the body", async () => {
    const request = new Request("http://localhost/api/portal/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: "unread-body" }),
    });
    const response = new Response("probe-response", { status: 200 });

    const fetch = vi.fn<(req: Request) => Response>((req) => {
      expect(req).toBe(request);
      return response;
    });
    const app = { fetch } as unknown as Hono;

    const result = await forwardToHono(app, request);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(request);
    expect(result).toBe(response);
  });
});
