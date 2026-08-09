import { describe, expect, it } from "vitest";
import { EnvError, parseServerEnv } from "./env";

const REQUIRED = {
  PORTAL_SECRET: "sk_portal_test",
  PORTAL_WEBHOOK_SECRET: "whsec_test",
} as const;

describe("parseServerEnv", () => {
  it("returns required secrets when AI is omitted (H1)", () => {
    const result = parseServerEnv({ ...REQUIRED } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      PORTAL_SECRET: "sk_portal_test",
      PORTAL_WEBHOOK_SECRET: "whsec_test",
    });
    expect(result.AI_GATEWAY_API_KEY).toBeUndefined();
    expect(result.AI_MODEL).toBeUndefined();
  });

  it("returns required secrets plus complete AI pair (H2)", () => {
    const result = parseServerEnv({
      ...REQUIRED,
      AI_GATEWAY_API_KEY: "gw_key",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      PORTAL_SECRET: "sk_portal_test",
      PORTAL_WEBHOOK_SECRET: "whsec_test",
      AI_GATEWAY_API_KEY: "gw_key",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    });
  });

  it("ignores unrelated environment keys (H3)", () => {
    const result = parseServerEnv({
      ...REQUIRED,
      PATH: "/usr/bin",
      NODE_ENV: "test",
      VITE_PORTAL_PUBLISHABLE_KEY: "pk_browser",
      PORTAL_WEBHOOK_URL: "https://example.test/webhook",
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      PORTAL_SECRET: "sk_portal_test",
      PORTAL_WEBHOOK_SECRET: "whsec_test",
    });
    expect(Object.keys(result).sort()).toEqual(
      ["PORTAL_SECRET", "PORTAL_WEBHOOK_SECRET"].sort(),
    );
  });

  it("trims required and AI values on output (H4)", () => {
    const result = parseServerEnv({
      PORTAL_SECRET: "  sk_portal_test  ",
      PORTAL_WEBHOOK_SECRET: "\twhsec_test\n",
      AI_GATEWAY_API_KEY: "  gw_key  ",
      AI_MODEL: "  anthropic/claude-sonnet-4.5  ",
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      PORTAL_SECRET: "sk_portal_test",
      PORTAL_WEBHOOK_SECRET: "whsec_test",
      AI_GATEWAY_API_KEY: "gw_key",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    });
  });

  it("fails when PORTAL_SECRET is missing (R1)", () => {
    expect(() =>
      parseServerEnv({
        PORTAL_WEBHOOK_SECRET: "whsec_test",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);

    try {
      parseServerEnv({
        PORTAL_WEBHOOK_SECRET: "whsec_test",
      } as NodeJS.ProcessEnv);
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).toContain("PORTAL_SECRET");
    }
  });

  it("fails when PORTAL_WEBHOOK_SECRET is missing (R2)", () => {
    try {
      parseServerEnv({
        PORTAL_SECRET: "sk_portal_test",
      } as NodeJS.ProcessEnv);
      expect.unreachable("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).toContain("PORTAL_WEBHOOK_SECRET");
    }
  });

  it("fails when PORTAL_SECRET is empty (R3)", () => {
    expect(() =>
      parseServerEnv({
        PORTAL_SECRET: "",
        PORTAL_WEBHOOK_SECRET: "whsec_test",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);
  });

  it("fails when PORTAL_SECRET is whitespace-only (R4)", () => {
    expect(() =>
      parseServerEnv({
        PORTAL_SECRET: "   ",
        PORTAL_WEBHOOK_SECRET: "whsec_test",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);
  });

  it("fails when PORTAL_WEBHOOK_SECRET is blank (R5)", () => {
    expect(() =>
      parseServerEnv({
        PORTAL_SECRET: "sk_portal_test",
        PORTAL_WEBHOOK_SECRET: "",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);

    expect(() =>
      parseServerEnv({
        PORTAL_SECRET: "sk_portal_test",
        PORTAL_WEBHOOK_SECRET: "   ",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);
  });

  it("fails when only AI_GATEWAY_API_KEY is set (A1)", () => {
    try {
      parseServerEnv({
        ...REQUIRED,
        AI_GATEWAY_API_KEY: "gw_only",
      } as NodeJS.ProcessEnv);
      expect.unreachable("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const message = (err as Error).message;
      expect(message).toMatch(/AI_GATEWAY_API_KEY/);
      expect(message).toMatch(/AI_MODEL/);
    }
  });

  it("fails when only AI_MODEL is set (A2)", () => {
    try {
      parseServerEnv({
        ...REQUIRED,
        AI_MODEL: "anthropic/claude-sonnet-4.5",
      } as NodeJS.ProcessEnv);
      expect.unreachable("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const message = (err as Error).message;
      expect(message).toMatch(/AI_GATEWAY_API_KEY/);
      expect(message).toMatch(/AI_MODEL/);
    }
  });

  it("fails when AI key is set and model is blank (A3)", () => {
    expect(() =>
      parseServerEnv({
        ...REQUIRED,
        AI_GATEWAY_API_KEY: "gw_key",
        AI_MODEL: "",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);

    expect(() =>
      parseServerEnv({
        ...REQUIRED,
        AI_GATEWAY_API_KEY: "gw_key",
        AI_MODEL: "   ",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);
  });

  it("fails when AI model is set and key is blank (A4)", () => {
    expect(() =>
      parseServerEnv({
        ...REQUIRED,
        AI_GATEWAY_API_KEY: "   ",
        AI_MODEL: "anthropic/claude-sonnet-4.5",
      } as NodeJS.ProcessEnv),
    ).toThrow(EnvError);
  });

  it("succeeds when both AI vars are blank with required present (A5)", () => {
    const result = parseServerEnv({
      ...REQUIRED,
      AI_GATEWAY_API_KEY: "",
      AI_MODEL: "   ",
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({
      PORTAL_SECRET: "sk_portal_test",
      PORTAL_WEBHOOK_SECRET: "whsec_test",
    });
  });

  it("does not echo secret values in error messages (S1)", () => {
    try {
      parseServerEnv({
        PORTAL_SECRET: "sk_live_super_secret",
        PORTAL_WEBHOOK_SECRET: "",
      } as NodeJS.ProcessEnv);
      expect.unreachable("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).not.toContain("sk_live_super_secret");
    }
  });

  it("does not echo AI secret values on incomplete pair (S2)", () => {
    try {
      parseServerEnv({
        ...REQUIRED,
        AI_GATEWAY_API_KEY: "gw_secret_value",
      } as NodeJS.ProcessEnv);
      expect.unreachable("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).not.toContain("gw_secret_value");
    }
  });

  it("throws typed EnvError instances (S3)", () => {
    expect(() => parseServerEnv({} as NodeJS.ProcessEnv)).toThrow(EnvError);
  });
});
