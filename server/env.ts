import { z } from "zod";

/** Thrown when required env is missing/blank or the AI pair is incomplete. */
export class EnvError extends Error {
  readonly name = "EnvError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Production server env after validation.
 * AI fields appear only when both are non-blank (complete pair).
 */
export type ServerEnv = {
  PORTAL_SECRET: string;
  PORTAL_WEBHOOK_SECRET: string;
  AI_GATEWAY_API_KEY?: string;
  AI_MODEL?: string;
};

const nonBlank = z.string().trim().min(1);

const serverEnvObjectSchema = z.object({
  PORTAL_SECRET: nonBlank,
  PORTAL_WEBHOOK_SECRET: nonBlank,
  AI_GATEWAY_API_KEY: nonBlank.optional(),
  AI_MODEL: nonBlank.optional(),
});

/**
 * Parse server production env.
 * Accepts a full `process.env`-like bag: unknown keys are ignored.
 * Returns only known keys with trimmed values.
 * Throws EnvError with key names only — never secret values.
 */
export function parseServerEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const candidate = {
    PORTAL_SECRET: env.PORTAL_SECRET,
    PORTAL_WEBHOOK_SECRET: env.PORTAL_WEBHOOK_SECRET,
    AI_GATEWAY_API_KEY: blankToUndefined(env.AI_GATEWAY_API_KEY),
    AI_MODEL: blankToUndefined(env.AI_MODEL),
  };

  const parsed = serverEnvObjectSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new EnvError(formatZodEnvError(parsed.error));
  }

  const data = parsed.data;
  const hasKey = data.AI_GATEWAY_API_KEY !== undefined;
  const hasModel = data.AI_MODEL !== undefined;
  if (hasKey !== hasModel) {
    throw new EnvError(
      "AI_GATEWAY_API_KEY and AI_MODEL must both be set (non-blank) or both be omitted",
    );
  }

  const out: ServerEnv = {
    PORTAL_SECRET: data.PORTAL_SECRET,
    PORTAL_WEBHOOK_SECRET: data.PORTAL_WEBHOOK_SECRET,
  };
  if (hasKey && hasModel) {
    out.AI_GATEWAY_API_KEY = data.AI_GATEWAY_API_KEY;
    out.AI_MODEL = data.AI_MODEL;
  }
  return out;
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.trim().length === 0 ? undefined : value;
}

function formatZodEnvError(error: z.ZodError): string {
  const names = new Set<string>();
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      names.add(key);
    }
  }
  if (names.size === 0) {
    return "Missing or blank environment variable";
  }
  const list = [...names].join(", ");
  return `Missing or blank environment variable: ${list}`;
}
