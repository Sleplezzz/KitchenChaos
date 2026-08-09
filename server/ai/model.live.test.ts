import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createModelClient } from "./model";

const RUN_LIVE = process.env.RUN_LIVE_AI_SMOKE === "1";
const REQUIRED_MODEL = "minimax/minimax-m3";
/** Production request timeout is 8000ms; allow a small margin for assertion overhead. */
const LIVE_TEST_TIMEOUT_MS = 10_000;

const LiveSmokeSchema = z
  .object({
    status: z.literal("live_ok"),
    thought: z.string().min(1).max(120),
  })
  .strict();

describe.skipIf(!RUN_LIVE)("createModelClient live MiniMax smoke", () => {
  it(
    "calls the configured MiniMax model through the production boundary",
    async () => {
      expect(
        process.env.AI_MODEL,
        `AI_MODEL must be exactly ${REQUIRED_MODEL}`,
      ).toBe(REQUIRED_MODEL);

      const client = createModelClient(process.env);
      expect(client, "ModelClient must be non-null (key + model present)").not
        .toBeNull();

      const result = await client!.generate({
        schema: LiveSmokeSchema,
        system:
          "You are a smoke-test helper. Reply only with structured output that matches the schema. Keep thought short.",
        prompt:
          'Return status exactly "live_ok" and a short thought confirming the live path works.',
      });

      expect(result).toEqual({
        status: "live_ok",
        thought: expect.any(String),
      });
      expect(result.thought.trim().length).toBeGreaterThan(0);
      expect(result.thought.length).toBeLessThanOrEqual(120);
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});
