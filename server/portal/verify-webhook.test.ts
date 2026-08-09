import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPortalWebhook } from "./verify-webhook";

const SECRET = "whsec_test_secret";
const RAW_BODY = '{"id":"m_1","type":"message.published"}';
/** Fixed clock: 2025-01-15T12:00:00.000Z */
const NOW_MS = 1_737_244_800_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

function sign(rawBody: string, timestampSeconds: number, secret = SECRET): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

describe("verifyPortalWebhook", () => {
  it("accepts a valid portal-signature for the raw body", () => {
    expect(() =>
      verifyPortalWebhook({
        rawBody: RAW_BODY,
        signatureHeader: sign(RAW_BODY, NOW_SECONDS),
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).not.toThrow();
  });

  it("rejects a missing portal-signature header", () => {
    expect(() =>
      verifyPortalWebhook({
        rawBody: RAW_BODY,
        signatureHeader: undefined,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toThrow();
  });

  it("rejects a malformed portal-signature header", () => {
    expect(() =>
      verifyPortalWebhook({
        rawBody: RAW_BODY,
        signatureHeader: "not-a-valid-header",
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toThrow();
  });

  it("rejects a wrong digest", () => {
    expect(() =>
      verifyPortalWebhook({
        rawBody: RAW_BODY,
        signatureHeader: `t=${NOW_SECONDS},v1=${"ab".repeat(32)}`,
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toThrow();
  });

  it("rejects a timestamp older than five minutes", () => {
    const sixMinutesAgo = NOW_SECONDS - 6 * 60;

    expect(() =>
      verifyPortalWebhook({
        rawBody: RAW_BODY,
        signatureHeader: sign(RAW_BODY, sixMinutesAgo),
        secret: SECRET,
        nowMs: NOW_MS,
      }),
    ).toThrow();
  });
});
