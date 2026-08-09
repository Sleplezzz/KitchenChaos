import { describe, expect, it } from "vitest";
import { honoApp } from "./app";

describe("GET /api/health", () => {
  it("reports that the API is ready", async () => {
    const response = await honoApp.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
