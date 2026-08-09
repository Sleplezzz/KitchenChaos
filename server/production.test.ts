import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hono } from "hono";
import type { AppDeps, ModelClient, PortalServerClient } from "./contracts";

const {
  createAppMock,
  createPortalServerClientMock,
  createModelClientMock,
  parseServerEnvMock,
} = vi.hoisted(() => {
  const createAppMock = vi.fn();
  const createPortalServerClientMock = vi.fn();
  const createModelClientMock = vi.fn();
  const parseServerEnvMock = vi.fn();
  return {
    createAppMock,
    createPortalServerClientMock,
    createModelClientMock,
    parseServerEnvMock,
  };
});

vi.mock("./app", () => ({
  createApp: createAppMock,
}));

vi.mock("./portal/client", () => ({
  createPortalServerClient: createPortalServerClientMock,
}));

vi.mock("./ai/model", () => ({
  createModelClient: createModelClientMock,
}));

vi.mock("./env", async () => {
  const actual = await vi.importActual<typeof import("./env")>("./env");
  return {
    ...actual,
    parseServerEnv: parseServerEnvMock,
  };
});

import {
  createProductionApp,
  createProductionDeps,
  getProductionApp,
} from "./production";
import { EnvError } from "./env";

const BASE_ENV = {
  PORTAL_SECRET: "sk_portal_prod",
  PORTAL_WEBHOOK_SECRET: "whsec_prod",
} as const;

function fakePortal(): PortalServerClient {
  return {
    readAllHistory: vi.fn(async () => {
      throw new Error("network must not be called");
    }),
    publishAgentEvent: vi.fn(async () => {
      throw new Error("network must not be called");
    }),
  };
}

function fakeModel(): ModelClient {
  return {
    generate: vi.fn(async () => {
      throw new Error("network must not be called");
    }),
  };
}

function fakeApp(label = "app"): Hono {
  return { fetch: vi.fn(), __label: label } as unknown as Hono;
}

describe("production wiring", () => {
  beforeEach(() => {
    createAppMock.mockReset();
    createPortalServerClientMock.mockReset();
    createModelClientMock.mockReset();
    parseServerEnvMock.mockReset();

    parseServerEnvMock.mockImplementation((env: NodeJS.ProcessEnv) => ({
      PORTAL_SECRET: env.PORTAL_SECRET,
      PORTAL_WEBHOOK_SECRET: env.PORTAL_WEBHOOK_SECRET,
      ...(env.AI_GATEWAY_API_KEY && env.AI_MODEL
        ? {
            AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
            AI_MODEL: env.AI_MODEL,
          }
        : {}),
    }));
    createPortalServerClientMock.mockImplementation(() => fakePortal());
    createModelClientMock.mockReturnValue(null);
    createAppMock.mockImplementation(() => fakeApp());
  });

  it("createProductionDeps wires portal, webhook secret, and model from env", () => {
    const portal = fakePortal();
    const model = fakeModel();
    createPortalServerClientMock.mockReturnValue(portal);
    createModelClientMock.mockReturnValue(model);

    const env = {
      ...BASE_ENV,
      AI_GATEWAY_API_KEY: "gw_key",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    } as NodeJS.ProcessEnv;

    const deps = createProductionDeps(env);

    expect(parseServerEnvMock).toHaveBeenCalledWith(env);
    expect(createPortalServerClientMock).toHaveBeenCalledWith({
      secret: "sk_portal_prod",
    });
    expect(createModelClientMock).toHaveBeenCalledWith({
      AI_GATEWAY_API_KEY: "gw_key",
      AI_MODEL: "anthropic/claude-sonnet-4.5",
    });
    expect(deps).toEqual({
      portal,
      model,
      webhookSecret: "whsec_prod",
    } satisfies AppDeps);
  });

  it("createProductionDeps passes no AI vars when the pair is omitted", () => {
    const env = { ...BASE_ENV } as NodeJS.ProcessEnv;
    createProductionDeps(env);

    expect(createModelClientMock).toHaveBeenCalledWith({});
  });

  it("createProductionApp builds createApp with production deps", () => {
    const portal = fakePortal();
    createPortalServerClientMock.mockReturnValue(portal);
    createModelClientMock.mockReturnValue(null);
    const app = fakeApp("production");
    createAppMock.mockReturnValue(app);

    const env = { ...BASE_ENV } as NodeJS.ProcessEnv;
    const result = createProductionApp(env);

    expect(createAppMock).toHaveBeenCalledWith({
      portal,
      model: null,
      webhookSecret: "whsec_prod",
    });
    expect(result).toBe(app);
  });

  it("createProductionDeps propagates EnvError without constructing clients", () => {
    parseServerEnvMock.mockImplementation(() => {
      throw new EnvError("Missing or blank environment variable: PORTAL_SECRET");
    });

    expect(() => createProductionDeps({} as NodeJS.ProcessEnv)).toThrow(EnvError);
    expect(createPortalServerClientMock).not.toHaveBeenCalled();
    expect(createModelClientMock).not.toHaveBeenCalled();
    expect(createAppMock).not.toHaveBeenCalled();
  });

  it("importing production does not parse env or construct clients", async () => {
    // Module already imported above; re-import is a no-op side-effect check after reset.
    parseServerEnvMock.mockClear();
    createPortalServerClientMock.mockClear();
    createModelClientMock.mockClear();
    createAppMock.mockClear();

    await import("./production");

    expect(parseServerEnvMock).not.toHaveBeenCalled();
    expect(createPortalServerClientMock).not.toHaveBeenCalled();
    expect(createModelClientMock).not.toHaveBeenCalled();
    expect(createAppMock).not.toHaveBeenCalled();
  });

  it("getProductionApp lazily constructs once and reuses the singleton", () => {
    const first = fakeApp("first");
    const second = fakeApp("second");
    createAppMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const env = { ...BASE_ENV } as NodeJS.ProcessEnv;
    const a = getProductionApp(env);
    const b = getProductionApp({
      PORTAL_SECRET: "other",
      PORTAL_WEBHOOK_SECRET: "other",
    } as NodeJS.ProcessEnv);

    expect(a).toBe(first);
    expect(b).toBe(first);
    expect(createAppMock).toHaveBeenCalledTimes(1);
    expect(parseServerEnvMock).toHaveBeenCalledTimes(1);
  });
});
