import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  createGatewayMock,
  providerMock,
  languageModel,
  generateTextMock,
  outputObjectMock,
} = vi.hoisted(() => {
  const languageModel = { id: "mock-language-model" };
  const providerMock = vi.fn(() => languageModel);
  const createGatewayMock = vi.fn(() => providerMock);
  const generateTextMock = vi.fn(async () => ({
    output: { thought: "structured" },
  }));
  const outputObjectMock = vi.fn((opts: { schema: unknown }) => ({
    kind: "object",
    schema: opts.schema,
  }));
  return {
    createGatewayMock,
    providerMock,
    languageModel,
    generateTextMock,
    outputObjectMock,
  };
});

vi.mock("ai", () => ({
  createGateway: createGatewayMock,
  generateText: generateTextMock,
  Output: {
    object: outputObjectMock,
  },
}));

import { createModelClient } from "./model";

describe("createModelClient", () => {
  beforeEach(() => {
    createGatewayMock.mockClear();
    providerMock.mockClear();
    generateTextMock.mockClear();
    outputObjectMock.mockClear();
  });

  it("returns null when AI_GATEWAY_API_KEY is missing", () => {
    const client = createModelClient({
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    } as NodeJS.ProcessEnv);

    expect(client).toBeNull();
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("returns null when AI_MODEL is missing", () => {
    const client = createModelClient({
      AI_GATEWAY_API_KEY: "key_123",
    } as NodeJS.ProcessEnv);

    expect(client).toBeNull();
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("returns null when both variables are missing", () => {
    expect(createModelClient({} as NodeJS.ProcessEnv)).toBeNull();
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("returns null when the API key is blank", () => {
    const client = createModelClient({
      AI_GATEWAY_API_KEY: "   ",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    } as NodeJS.ProcessEnv);

    expect(client).toBeNull();
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("returns null when the model identifier is blank", () => {
    const client = createModelClient({
      AI_GATEWAY_API_KEY: "key_123",
      AI_MODEL: "",
    } as NodeJS.ProcessEnv);

    expect(client).toBeNull();
    expect(createGatewayMock).not.toHaveBeenCalled();
  });

  it("returns a ModelClient when both variables are present", () => {
    const client = createModelClient({
      AI_GATEWAY_API_KEY: "key_123",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    } as NodeJS.ProcessEnv);

    expect(client).not.toBeNull();
    expect(typeof client!.generate).toBe("function");
  });

  it("wires generate through createGateway without network", async () => {
    // Break: gateway key/model wiring, Output.object, retries, or timeout drift.
    const apiKey = "injected_key_abc";
    const modelId = "anthropic/claude-sonnet-4.5";
    const client = createModelClient({
      AI_GATEWAY_API_KEY: apiKey,
      AI_MODEL: modelId,
    } as NodeJS.ProcessEnv);

    expect(client).not.toBeNull();
    expect(createGatewayMock).toHaveBeenCalledTimes(1);
    expect(createGatewayMock).toHaveBeenCalledWith({ apiKey });
    expect(providerMock).toHaveBeenCalledTimes(1);
    expect(providerMock).toHaveBeenCalledWith(modelId);

    const schema = z.object({ thought: z.string() });
    const system = "You are a test agent.";
    const prompt = "Return a short thought.";

    const result = await client!.generate({ schema, system, prompt });

    expect(result).toEqual({ thought: "structured" });
    expect(outputObjectMock).toHaveBeenCalledTimes(1);
    expect(outputObjectMock).toHaveBeenCalledWith({ schema });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).toHaveBeenCalledWith({
      model: languageModel,
      output: { kind: "object", schema },
      system,
      prompt,
      maxRetries: 0,
      timeout: 8000,
    });
  });
});
