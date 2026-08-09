import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export function verifyPortalWebhook(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  secret: string;
  nowMs: number;
}): void {
  const { rawBody, signatureHeader, secret, nowMs } = input;

  if (!signatureHeader) {
    throw new WebhookVerificationError("Missing portal-signature header.");
  }

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) parts.set(key, value);
  }

  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) {
    throw new WebhookVerificationError("Malformed portal-signature header.");
  }

  const age = Math.abs(nowMs / 1000 - Number(t));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      "Signature timestamp outside tolerance.",
    );
  }

  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const providedBytes = Buffer.from(v1, "hex");

  const signatureMatches =
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);

  if (!signatureMatches) {
    throw new WebhookVerificationError("Signature does not match.");
  }
}
