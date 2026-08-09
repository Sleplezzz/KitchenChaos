import { describe, it, expect } from "vitest";
import { getGatewayModel } from "./gateway.js";

describe("getGatewayModel", () => {
  it("devuelve null si falta AI_GATEWAY_API_KEY", () => {
    const result = getGatewayModel({ AI_MODEL: "anthropic/claude-sonnet-4-5" } as NodeJS.ProcessEnv);
    expect(result).toBeNull();
  });

  it("devuelve null si falta AI_MODEL", () => {
    const result = getGatewayModel({ AI_GATEWAY_API_KEY: "key_123" } as NodeJS.ProcessEnv);
    expect(result).toBeNull();
  });

  it("devuelve null si faltan ambas", () => {
    expect(getGatewayModel({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("devuelve el modelo cuando ambas variables están presentes", () => {
    const result = getGatewayModel({
      AI_GATEWAY_API_KEY: "key_123",
      AI_MODEL: "anthropic/claude-sonnet-4-5",
    } as NodeJS.ProcessEnv);

    expect(result).toEqual({ modelId: "anthropic/claude-sonnet-4-5" });
  });
});
