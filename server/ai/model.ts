import { createGateway, generateText, Output } from "ai";
import type { z } from "zod";
import type { ModelClient } from "../contracts";

function readNonBlank(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * AI Gateway boundary. Returns null when the key or model id is absent/blank
 * so callers use deterministic agent fallbacks without touching the network.
 */
export function createModelClient(
  env: NodeJS.ProcessEnv = process.env,
): ModelClient | null {
  const apiKey = readNonBlank(env.AI_GATEWAY_API_KEY);
  const modelId = readNonBlank(env.AI_MODEL);

  if (!apiKey || !modelId) {
    return null;
  }

  const provider = createGateway({ apiKey });
  const languageModel = provider(modelId);

  return {
    async generate<T>(input: {
      schema: z.ZodType<T>;
      system: string;
      prompt: string;
    }): Promise<T> {
      const { output } = await generateText({
        model: languageModel,
        output: Output.object({ schema: input.schema }),
        system: input.system,
        prompt: input.prompt,
        maxRetries: 0,
        timeout: 8000,
      });

      if (output === undefined || output === null) {
        throw new Error("Model returned empty structured output");
      }

      return output as T;
    },
  };
}
