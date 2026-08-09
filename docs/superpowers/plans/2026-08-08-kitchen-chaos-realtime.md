# Kitchen Chaos Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a testable realtime kitchen where three human roles and three AI agents share one Portal event stream.

**Architecture:** A Vite React client joins one anonymous Portal channel per room. A stateless Hono webhook rebuilds the room from Portal history, runs one bounded agent decision, and publishes a new Portal event. The client and server use the same pure reducer.

**Tech Stack:** Node.js 24 LTS, pnpm, TypeScript, React, Vite 8.1, Hono, Portal SDK, AI SDK Core, AI Gateway, Zod, Vitest, and Vercel Functions.

## Global Constraints

- Node.js 24, pnpm, the Vercel CLI, and the Portal CLI must be ready before implementation.
- The human owns machine-level installation and account login.
- Work only in `/home/herrera/projects/hackathons/KitchenChaos`.
- Do not read or copy source from the mistaken `Kitchen-Chaos` path.
- Use pnpm only. Do not create an npm, Yarn, or Bun lockfile.
- Use TypeScript for all application and test code.
- Resolve stable package releases at implementation time. Use Vite `^8.1.0`.
- Do not use beta, canary, release-candidate, or experimental package releases.
- Follow test-driven development. Write a failing test before each behavior.
- Use Vitest with the Node environment. Do not add a DOM test environment.
- Do not add Express, LangChain, LangGraph, AWS Strands, or an external state store.
- Portal persistent messages are the only kitchen state source.
- The Hono process must remain stateless between requests.
- Do not add conversational model memory. Portal history is the product memory.
- Use AI SDK Core with AI Gateway as the only model backend.
- Keep AI Gateway selection inside `server/ai/model.ts`.
- Keep deterministic agent fallbacks. A missing model key must not break the demo.
- Do not add a login flow. Human roles are product views, not security roles.
- Implement only the `station.failed` chaos event.
- Support several active orders in one room.
- Do not implement Portal Extensions or snapshots.
- Do not commit, stage, or push changes until the user gives explicit approval.
- End each task with a diff review and a human commit checkpoint.

## Deferred Portal Decision

Portal Extensions and snapshots solve a problem that this MVP does not have.

- Persistent messages and the shared reducer rebuild a new or short room.
- An Extension adds another runtime and a `portal deploy` step.
- It adds a namespace, `onBatch`, `onSnapshot`, `ctx.storage`, and `snapshotDirty`.
- It also adds `batchSeq` control and separate idempotency rules.
- Reconsider it only when long rooms make history replay slow or incomplete.

Use these files if that condition occurs:

- `agent/docs/portal/extensions.md`
- `agent/docs/portal/channels.md`
- `agent/docs/portal/webhooks.md`
- `agent/docs/portal/openapi.md`
- `agent/tmp/kitchen-chaos-portal-research.md`
- `agent/tmp/testing-stack-research.md`

The testing worker report remains temporary. The coordinator validated its sources and rejected its old `node:test` recommendation. This plan uses Vite 8 and Vitest.

## Repository Baseline

The repository contains a compiled static prototype, the approved spec, and local Portal documentation. It has no maintainable TypeScript source tree.

Implementation must make these changes:

- Replace `index.html` with the Vite entry.
- Delete `assets/index-ByBvyWT9.css`.
- Delete `assets/index-WX-qLDcB.js`.
- Preserve the kitchen ticket and operations-board visual language.
- Preserve `docs/superpowers/specs/2026-08-08-kitchen-chaos-realtime-design.md`.
- Preserve `agent/docs/portal/` as the local Portal reference.
- Keep temporary worker reports under `agent/tmp/`.
- Use `agent/tmp/ai-provider-portability.md` if the model provider decision needs review.

## Target File Map

```text
.env.example
.gitignore
index.html
package.json
pnpm-lock.yaml
portal.config.ts
tsconfig.json
vite.config.ts
vitest.config.ts

api/
  health.ts
  portal/
    webhook.ts

server/
  agents/
    decisions.ts
    decisions.test.ts
    schemas.ts
  ai/
    model.ts
  app.ts
  app.test.ts
  contracts.ts
  env.ts
  orchestrator.ts
  portal/
    client.ts
    client.test.ts
    verify-webhook.ts
    verify-webhook.test.ts
  production.ts

src/
  App.tsx
  main.tsx
  styles.css
  domain/
    events.ts
    events.test.ts
    fixtures.ts
    menu.ts
    projection.ts
    reducer.ts
    reducer.test.ts
    selectors.ts
  portal/
    client.ts
    messages.ts
    messages.test.ts
    room.ts
    useKitchenRoom.ts
  ui/
    CookView.tsx
    CustomerView.tsx
    JoinScreen.tsx
    KitchenShell.tsx
    ManagerView.tsx
    PresenceBar.tsx
```

## Shared Contracts

Create these types before parallel frontend and backend work:

```ts
export type HumanRole = "customer" | "cook" | "manager";
export type AgentRole = "coordinator" | "backup" | "delivery";
export type OrderStage = "received" | "cooking" | "ready" | "delivered";
export type StationId = "principal" | "reserve";
export type StationStatus = "ok" | "failed";
export type PriorityScore = 1 | 2 | 3;

export type PortalMessageLike = {
  id: string;
  seq: number;
  timestamp: number;
  retracted: boolean;
  ephemeral: false;
  content: unknown;
};

export type PresenceMeta = {
  displayName: string;
  role: HumanRole;
};

export type OrderItem = {
  menuItemId: "smash-burger" | "veggie-bowl" | "loaded-fries";
  quantity: 1 | 2 | 3;
};

export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  stage: OrderStage;
  station: StationId | null;
  priorityScore: PriorityScore | null;
  createdSeq: number;
  updatedSeq: number;
};

export type AgentActivity = {
  thought: string;
  lastActionKey: string;
  updatedSeq: number;
};
```

Use serializable records for reducer idempotency:

```ts
export type KitchenProjection = {
  roomId: string;
  orders: Record<string, Order>;
  stations: Record<StationId, StationStatus>;
  agents: Record<AgentRole, AgentActivity | null>;
  appliedMessageIds: Record<string, true>;
  appliedActionKeys: Record<string, true>;
};
```

Do not use `Set` in the projection. A plain record works in the browser, tests, and serialized fixtures.

---

## Task 1: Replace the Static Build with the TypeScript Toolchain

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `server/contracts.ts`
- Create: `server/app.test.ts`
- Create: `server/app.ts`
- Modify: `.gitignore`
- Replace: `index.html`
- Delete: `assets/index-ByBvyWT9.css`
- Delete: `assets/index-WX-qLDcB.js`

- [ ] Add the project manifest and scripts.

Use these scripts:

```json
{
  "name": "kitchen-chaos",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "dev:web": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "vite build"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

- [ ] Add stable runtime packages with pnpm.

```bash
pnpm add @portalsdk/core@latest @portalsdk/react@latest ai@latest hono@latest react@latest react-dom@latest zod@latest
pnpm add -D @portalsdk/config@latest @types/node@latest @types/react@latest @types/react-dom@latest @vitejs/plugin-react@latest typescript@latest vercel@latest vite@^8.1.0 vitest@latest
```

Expected result: pnpm writes one `pnpm-lock.yaml` with stable resolved versions.

- [ ] Configure strict TypeScript for browser and Node files.

Set `module` to `ESNext`, `moduleResolution` to `Bundler`, and `jsx` to `react-jsx`. Include `src`, `server`, `api`, and root configuration files.

- [ ] Configure Vite with the stable React plugin.

- [ ] Configure Vitest with `environment: "node"` and `include: ["{src,server}/**/*.test.ts"]`.

- [ ] Write the first failing Hono health test.

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("GET /api/health", () => {
  it("reports that the API is ready", async () => {
    const app = createApp({ portal: null, model: null, webhookSecret: "test" });
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] Run the test and confirm the red state.

```bash
pnpm test -- server/app.test.ts
```

Expected failure: Vitest cannot import `createApp` from `server/app.ts`.

- [ ] Implement `createApp(deps)` and the health route.

Define `AppDeps` in `server/contracts.ts`. Use nullable Portal and model clients only during this scaffold task.

- [ ] Run the health test and confirm the green state.

```bash
pnpm test -- server/app.test.ts
```

Expected result: one health test passes.

- [ ] Replace the compiled page with a minimal Vite React entry.

Render `Kitchen Chaos` and `Realtime kitchen loading` from `src/App.tsx`. Do not copy the minified JavaScript bundle.

- [ ] Expand `.gitignore`.

```text
agent/tmp
node_modules
dist
.vercel
.env
.env.local
```

- [ ] Delete the two tracked compiled assets after the Vite entry exists.

- [ ] Run the task verification.

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected result: all commands pass. `dist/` remains ignored.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 2: Define Domain Events, Menu Data, and Action Keys

**Files:**

- Create: `src/domain/menu.ts`
- Create: `src/domain/events.test.ts`
- Create: `src/domain/events.ts`
- Create: `src/domain/fixtures.ts`

- [ ] Define a small static menu in `menu.ts`.

Use `smash-burger`, `veggie-bowl`, and `loaded-fries` as identifiers. Use `quick`, `standard`, and `quick` as their preparation classes.

- [ ] Write failing schema tests for all six domain events.

Test these human events:

- `order.created` from `customer`
- `order.ready` from `cook`
- `station.failed` from `manager`

Test these agent events:

- `order.assigned` from `coordinator`
- `order.reassigned` from `backup`
- `order.delivered` from `delivery`

- [ ] Add rejection tests.

Reject these values:

- `version: 2`
- `priorityScore: 0`
- `priorityScore: 4`
- A Principal failure that names Reserve
- An agent event without `causedBy`
- An agent event without `actionKey`
- An explanation longer than 120 characters

- [ ] Add a failing action-key stability test.

```ts
expect(
  buildActionKey({
    triggerId: "m_42",
    agentRole: "backup",
    actionType: "order.reassigned",
    orderId: "550e8400-e29b-41d4-a716-446655440000",
  }),
).toBe("m_42:backup:order.reassigned:550e8400-e29b-41d4-a716-446655440000");
```

- [ ] Run the tests and confirm the red state.

```bash
pnpm test -- src/domain/events.test.ts
```

Expected failure: the event schemas and `buildActionKey` do not exist.

- [ ] Implement the common schemas.

Use these exact bounded values:

```ts
export const priorityScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const contextHintSchema = z
  .object({
    stations: z.object({
      principal: z.enum(["ok", "failed"]),
      reserve: z.enum(["ok", "failed"]),
    }),
    affectedOrderIds: z.array(z.string().uuid()).max(30),
  })
  .strict();
```

Limit an order to eight line items. Limit each quantity to `1`, `2`, or `3`.

Require `roomId` to match `^kitchen-[a-z0-9]{4,12}$`.

- [ ] Use these exact payload fields.

| Event              | Payload                                             |
| ------------------ | --------------------------------------------------- |
| `order.created`    | `orderId`, `customerId`, `customerName`, `items`    |
| `order.ready`      | `orderId`                                           |
| `station.failed`   | `station: "principal"`                              |
| `order.assigned`   | `orderId`, `station`, `priorityScore`               |
| `order.reassigned` | `orderId`, `station: "reserve"`, `priorityScore: 3` |
| `order.delivered`  | `orderId`                                           |

- [ ] Implement a strict discriminated union for the six event types.

Store `thought`, `causedBy`, `actionKey`, and `agentRole` at the agent event top level. Do not duplicate `thought` inside `payload`.

- [ ] Export inferred TypeScript types from the Zod schemas.

Use these exported names:

```ts
export type ContextHint = z.infer<typeof contextHintSchema>;
export type HumanKitchenEvent = z.infer<typeof humanKitchenEventSchema>;
export type AgentKitchenEvent = z.infer<typeof agentKitchenEventSchema>;
export type KitchenEventContent = z.infer<typeof kitchenEventSchema>;
```

- [ ] Add fixture builders for a Portal envelope and each valid event.

- [ ] Run the task verification.

```bash
pnpm test -- src/domain/events.test.ts
pnpm typecheck
git diff --check
```

Expected result: all event and action-key tests pass.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 3: Build the Shared Projection, Reducer, and Queue Selectors

**Files:**

- Create: `src/domain/projection.ts`
- Create: `src/domain/reducer.test.ts`
- Create: `src/domain/reducer.ts`
- Create: `src/domain/selectors.ts`
- Modify: `src/domain/fixtures.ts`
- Modify: `server/contracts.ts`
- Modify: `server/app.test.ts`

- [ ] Write a reducer test for the complete order path.

The test must apply this sequence:

```text
order.created -> order.assigned -> order.ready -> order.delivered
```

Assert these stages in order: `received`, `cooking`, `ready`, `delivered`.

- [ ] Write a test with three active orders.

Use priority scores `3`, `2`, and `2`. Give the two normal orders different creation sequence numbers.

- [ ] Write the queue order assertion.

```ts
expect(selectCookQueue(projection).map((order) => order.id)).toEqual([
  "550e8400-e29b-41d4-a716-446655440001",
  "550e8400-e29b-41d4-a716-446655440002",
  "550e8400-e29b-41d4-a716-446655440003",
]);
```

- [ ] Add reducer rejection and replay tests.

Cover these cases:

- Duplicate Portal message ID
- Duplicate agent `actionKey`
- `ready` before `assigned`
- `delivered` before `ready`
- Assignment to a failed station
- Unknown event type
- Contract version `2`
- Retracted message

- [ ] Add a multi-order station failure test.

Fail Principal with two active Principal orders. Reassign both orders to Reserve with priority `3`. Do not change their current stages.

- [ ] Run the tests and confirm the red state.

```bash
pnpm test -- src/domain/reducer.test.ts
```

Expected failure: projection, reducer, and selectors do not exist.

- [ ] Implement `createEmptyProjection(roomId)`.

Set both stations to `ok`. Set all agent activity values to `null`. Use empty records for orders and idempotency keys.

- [ ] Implement the pure reducer.

Use this signature:

```ts
export function reduceKitchen(
  state: KitchenProjection,
  message: PortalMessageLike,
): KitchenProjection;
```

Parse `message.content` with `kitchenEventSchema`. Never call the clock, Portal, React, Hono, or the model.

- [ ] Implement the forward-only stage rules.

- [ ] Implement `projectKitchen(roomId, messages)`.

Sort messages by ascending `seq` before reduction. Do not trust array arrival order.

- [ ] Implement selectors.

Export these functions:

```ts
export function selectCookQueue(state: KitchenProjection): Order[];
export function selectCustomerOrders(
  state: KitchenProjection,
  customerId: string,
): Order[];
export function selectAffectedPrincipalOrders(
  state: KitchenProjection,
): Order[];
```

- [ ] Replace the scaffold dependencies with stable server interfaces.

```ts
export type PortalServerClient = {
  readAllHistory(channelId: string): Promise<PortalMessageLike[]>;
  publishAgentEvent(
    channelId: string,
    event: AgentKitchenEvent,
  ): Promise<{ id: string; seq: number; timestamp: number }>;
};

export type ModelClient = {
  generate<T>(input: {
    schema: z.ZodType<T>;
    system: string;
    prompt: string;
  }): Promise<T>;
};

export type AppDeps = {
  portal: PortalServerClient;
  model: ModelClient | null;
  webhookSecret: string;
  now?: () => number;
};
```

- [ ] Replace the null Portal dependency in the health test with a two-method fake.

Keep `model: null` because the missing-model path is a required fallback case.

- [ ] Run the task verification.

```bash
pnpm test -- src/domain/reducer.test.ts
pnpm typecheck
git diff --check
```

Expected result: the reducer table and queue tests pass.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 4: Verify Webhooks and Implement the Portal HTTP Client

**Files:**

- Create: `server/portal/verify-webhook.test.ts`
- Create: `server/portal/verify-webhook.ts`
- Create: `server/portal/client.test.ts`
- Create: `server/portal/client.ts`

- [ ] Write signature tests with a fixed clock.

Cover a valid signature, missing header, malformed header, wrong digest, and a timestamp older than five minutes.

- [ ] Run the signature tests and confirm the red state.

```bash
pnpm test -- server/portal/verify-webhook.test.ts
```

Expected failure: `verifyPortalWebhook` does not exist.

- [ ] Implement the exact Portal signature algorithm.

Compute `HMAC-SHA256(secret, "{timestamp}.{rawBody}")`. Compare equal-length buffers with `timingSafeEqual`.

Use this signature:

```ts
export function verifyPortalWebhook(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  secret: string;
  nowMs: number;
}): void;
```

- [ ] Write Portal client tests with an injected `fetch` function.

Test these requests:

1. Mint a five-minute technical token with `POST https://api.useportal.co/v1/tokens`.
2. Read history from `https://realtime.useportal.co/v1/channels/{channelId}/history`.
3. Page with `before` until `hasMore` is false.
4. Publish through `POST https://api.useportal.co/v1/channels/{channelId}/messages`.

- [ ] Assert the server publish body.

```ts
expect(publishBody).toMatchObject({
  senderId: "agent-backup",
  type: "order.reassigned",
  kind: "text",
  content: reassignedEvent,
});
```

- [ ] Run the client tests and confirm the red state.

```bash
pnpm test -- server/portal/client.test.ts
```

Expected failure: `createPortalServerClient` does not exist.

- [ ] Implement token minting for history reads.

Use user ID `agent-{channelId}`. Grant `connect` only to the requested channel. Use a five-minute token TTL.

- [ ] Implement full history paging.

Request 100 messages per page. Use the first sequence number as the next `before` value. Return one ascending list without retracted messages.

- [ ] Implement server publishing with `PORTAL_SECRET`.

Do not send the secret key to the realtime host or browser.

- [ ] Run the task verification.

```bash
pnpm test -- server/portal
pnpm typecheck
git diff --check
```

Expected result: signature and HTTP client tests pass without network calls.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 5: Implement the AI Gateway Boundary and Agent Fallbacks

**Files:**

- Create: `server/agents/schemas.ts`
- Create: `server/agents/decisions.test.ts`
- Create: `server/agents/decisions.ts`
- Create: `server/ai/model.ts`

- [ ] Define strict model response schemas.

```ts
export const coordinatorDecisionSchema = z
  .object({
    station: z.enum(["principal", "reserve"]),
    priorityScore: priorityScoreSchema,
    thought: z.string().min(1).max(120),
  })
  .strict();

export const thoughtDecisionSchema = z
  .object({
    thought: z.string().min(1).max(120),
  })
  .strict();
```

- [ ] Write Coordinator tests.

Cover these cases:

- A valid structured decision creates one `order.assigned` event.
- Fewer than three active orders defaults to priority `2` in fallback mode.
- A failed Principal station forces Reserve.
- Model failure uses a short deterministic explanation.
- A returned priority outside `1` to `3` activates the fallback.

- [ ] Write Backup tests.

Use three active orders. Place two on Principal and one on Reserve. Assert two `order.reassigned` events with priority `3`.

- [ ] Write Delivery tests.

Assert one `order.delivered` event for a valid `order.ready` trigger. Assert no action for another event type.

- [ ] Write an idempotency test.

Add the planned `actionKey` to `projection.appliedActionKeys`. Assert that the planner returns no event.

- [ ] Run the agent tests and confirm the red state.

```bash
pnpm test -- server/agents/decisions.test.ts
```

Expected failure: the decision planner does not exist.

- [ ] Implement one bounded decision call per trigger.

Export this surface:

```ts
export async function planAgentEvents(input: {
  trigger: PortalMessageLike;
  event: HumanKitchenEvent;
  projection: KitchenProjection | null;
  contextHint: ContextHint | null;
  model: ModelClient | null;
}): Promise<AgentKitchenEvent[]>;
```

- [ ] Keep all domain authority outside the model.

Hono selects the agent, builds action keys, overrides failed stations, sets Backup priority `3`, and validates every event.

- [ ] Implement AI Gateway in one file.

Use `createGateway({ apiKey })`, `generateText`, and `Output.object({ schema })`. Read the model identifier from `AI_MODEL`.

- [ ] Return `null` model support when the key or model identifier is absent.

The decision planner must use deterministic fallbacks when `model` is `null` or throws.

- [ ] Do not add OpenRouter imports or configuration.

- [ ] Run the task verification.

```bash
pnpm test -- server/agents/decisions.test.ts
pnpm typecheck
git diff --check
```

Expected result: every agent works with a successful model and with no model.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 6: Connect the Hono Webhook Orchestrator

**Files:**

- Create: `server/orchestrator.ts`
- Modify: `server/app.test.ts`
- Modify: `server/app.ts`
- Create: `server/env.ts`
- Create: `server/production.ts`
- Create: `api/health.ts`
- Create: `api/portal/webhook.ts`
- Create: `.env.example`

- [ ] Add a webhook test helper that signs the exact raw JSON body.

- [ ] Define the Portal delivery schema.

Require `id`, `timestamp`, `environmentId`, `channelId`, and `data`. Accept only `message.published` and `message.retracted` delivery types. Require persistent message data to include `id`, `seq`, `content`, `sender`, `timestamp`, `retracted`, and `ephemeral`.

- [ ] Write a failing invalid-signature route test.

Send `POST /api/portal/webhook` with a bad `portal-signature`. Assert `401` and no Portal client calls.

- [ ] Write ignored-event tests.

Assert `200` with no publish for these deliveries:

- `message.retracted`
- An agent-authored event
- An unknown domain event
- An invalid event contract

- [ ] Write Coordinator, Backup, and Delivery route tests.

Each test must provide fake history, a fake model, and a fake Portal publisher. Assert the exact published event.

- [ ] Write replay tests.

Place the expected action key in history. Assert that the route returns `200` and does not call the model or publish.

- [ ] Write failure tests.

Cover these results:

- Model timeout uses the fallback and returns `200`.
- Portal publish failure returns a non-2xx response.
- History failure uses a sufficient `contextHint`.
- History failure without sufficient context returns a non-2xx response.

Use `502` for an upstream Portal publish failure. Use `503` when history and the compact hint are both insufficient.

- [ ] Run the route tests and confirm the red state.

```bash
pnpm test -- server/app.test.ts
```

Expected failure: the webhook route and orchestrator do not exist.

- [ ] Implement the webhook route in this order.

1. Read `await c.req.text()` once.
2. Verify `portal-signature` against the raw text.
3. Parse the Portal delivery.
4. Accept only `message.published` human events.
5. Read full Portal history.
6. Merge the current trigger if history does not contain it.
7. Build the room projection with the shared reducer.
8. Plan zero or more agent events.
9. Publish each non-duplicate agent event.
10. Return a small JSON result.

Return `{ ok: true, ignored: true }` for ignored deliveries. Return `{ ok: true, published: number }` after agent processing.

- [ ] Keep `contextHint` recovery compact.

For Coordinator, use station status from the hint. For Backup, use `affectedOrderIds`. For Delivery, use the trigger order ID.

- [ ] Implement strict server environment parsing.

Require `PORTAL_SECRET` and `PORTAL_WEBHOOK_SECRET`. Treat `AI_GATEWAY_API_KEY` and `AI_MODEL` as optional together.

- [ ] Create production dependencies in `server/production.ts`.

- [ ] Export Web-standard Vercel handlers.

Use this pattern in both API files:

```ts
import { productionApp } from "../server/production";

export default {
  fetch(request: Request) {
    return productionApp.fetch(request);
  },
};
```

Use `../../server/production` from `api/portal/webhook.ts`.

- [ ] Document the exact environment surface.

```text
VITE_PORTAL_PUBLISHABLE_KEY=
PORTAL_SECRET=
PORTAL_WEBHOOK_SECRET=
AI_GATEWAY_API_KEY=
AI_MODEL=
PORTAL_WEBHOOK_URL=
```

- [ ] Run the task verification.

```bash
pnpm test -- server
pnpm typecheck
pnpm build
git diff --check
```

Expected result: route tests pass with fakes. No test calls Portal or AI Gateway.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 7: Connect the Browser to Portal History and Presence

**Files:**

- Create: `src/portal/room.ts`
- Create: `src/portal/client.ts`
- Create: `src/portal/messages.test.ts`
- Create: `src/portal/messages.ts`
- Create: `src/portal/useKitchenRoom.ts`
- Modify: `src/main.tsx`

- [ ] Write room-code normalization tests.

```ts
expect(toRoomId("  ABC-42 ")).toBe("kitchen-abc42");
expect(() => toRoomId("a")).toThrow();
```

Accept four to twelve letters or digits after normalization.

- [ ] Write browser event-builder tests.

Build `order.created`, `order.ready`, and `station.failed`. Parse each result with `kitchenEventSchema`.

- [ ] Add a message-size test.

Assert that UTF-8 encoded JSON for each human event is less than 2,048 bytes.

- [ ] Write a projection adapter test.

Give the adapter unordered Portal SDK messages. Assert that it returns the same projection as ascending reducer input.

- [ ] Run the tests and confirm the red state.

```bash
pnpm test -- src/portal/messages.test.ts
```

Expected failure: browser Portal helpers do not exist.

- [ ] Create one browser Portal client.

```ts
import { Portal } from "@portalsdk/core";

export const portal = new Portal({
  apiKey: import.meta.env.VITE_PORTAL_PUBLISHABLE_KEY,
});
```

Do not pass a token. Portal anonymous mode keeps a stable identity across browser reloads.

- [ ] Wrap the React tree with the verified provider API.

```tsx
<PortalProvider client={portal}>
  <App />
</PortalProvider>
```

- [ ] Implement `useKitchenRoom` with `useChannel`.

Pass these options:

```ts
useChannel<KitchenEventContent>({
  channelId: roomId,
  history: 100,
  metadata: { displayName, role },
});
```

- [ ] Load older pages while `hasPrevious` is true.

Call `loadPrevious()` only when the channel is ready and not already loading.

- [ ] Keep presence metadata current.

Call `setMetadata({ displayName, role })` when either value changes on an existing channel handle.

- [ ] Publish persistent human events.

Use `send({ type: event.type, kind: "text", content: event })`. Never update a local authoritative order array.

- [ ] Return these values from the hook.

```ts
{
  projection,
  presence,
  me,
  status,
  sendOrder,
  markOrderReady,
  failPrincipal,
}
```

- [ ] Run the task verification.

```bash
pnpm test -- src/portal/messages.test.ts src/domain
pnpm typecheck
pnpm build
git diff --check
```

Expected result: browser helpers pass in Node tests. The React build compiles without a DOM test runtime.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 8: Build the Three Role Views

**Files:**

- Create: `src/ui/JoinScreen.tsx`
- Create: `src/ui/KitchenShell.tsx`
- Create: `src/ui/PresenceBar.tsx`
- Create: `src/ui/CustomerView.tsx`
- Create: `src/ui/CookView.tsx`
- Create: `src/ui/ManagerView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] Build the join screen.

Ask for a display name, room code, and one role. Do not add an account, password, or role authorization flow.

- [ ] Build the shared header.

Show the room code, connection state, detailed presence, and recent agent activity. If Portal returns aggregate presence, show the count.

- [ ] Build the Customer view.

Show the three menu items and quantity controls. Let the Customer submit several orders. Filter order status by `me.id`.

- [ ] Build the Cook view.

Show only active cooking orders. Group them by Principal and Reserve. Sort with `selectCookQueue`. Allow any valid cooking order to become ready.

- [ ] Build the Manager view.

Show the four stages, both station states, priority marks, recent agent actions, and presence. Add one Principal failure control.

- [ ] Disable the chaos control after Principal fails.

- [ ] Use one clear visual priority treatment.

Use three labels: `P1`, `P2`, and `P3`. Do not add analytics, charts, or decorative metrics.

- [ ] Keep agent explanations short.

Show only the latest operational sentence for each agent. Do not show chain-of-thought.

- [ ] Keep local state limited to forms and view selection.

Do not add local order progression, fake users, fake presence, ambient orders, or timers.

- [ ] Run the task verification.

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected result: all automated checks pass. The production bundle contains the three role views.

- [ ] Stop at the human checkpoint. Do not stage or commit.

---

## Task 9: Configure Portal and Verify the Real Demo

**Files:**

- Create: `portal.config.ts`
- Modify: `.env.example`
- Modify: `agent/docs/portal/README.md` only if a new official page was added

- [ ] Create the Portal project configuration.

```ts
import { defineConfig } from "@portalsdk/config";

const webhookUrl = process.env.PORTAL_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("PORTAL_WEBHOOK_URL is required for portal deploy.");
}

export default defineConfig({
  channels: {
    "kitchen-*": { anonymous: true },
  },
  webhooks: {
    url: webhookUrl,
  },
});
```

- [ ] Confirm that the human supplied the required credentials.

The browser receives only `VITE_PORTAL_PUBLISHABLE_KEY`. Hono receives `PORTAL_SECRET`, `PORTAL_WEBHOOK_SECRET`, and AI values.

- [ ] Register local and deployed origins in Portal.

- [ ] Deploy the Vercel preview and set its HTTPS webhook URL.

- [ ] Run `portal deploy` with `PORTAL_WEBHOOK_URL` set to the deployed endpoint.

- [ ] Check the deployed health route.

Set `KITCHEN_CHAOS_ORIGIN` to the deployed preview origin before this check.

```bash
curl --fail --show-error "$KITCHEN_CHAOS_ORIGIN/api/health"
```

Expected body: `{"ok":true}`.

- [ ] Run the three-browser realtime test.

1. Open a fresh room as Customer, Cook, and Manager.
2. Confirm that presence shows all three names and roles.
3. Create two Customer orders without waiting between them.
4. Confirm that both orders appear in every browser within two seconds.
5. Confirm that Coordinator assigns both orders.
6. Fail Principal from the Manager view.
7. Confirm that Backup moves every affected order to Reserve with priority `3`.
8. Mark one cooking order ready from the Cook view.
9. Confirm that Delivery completes it in every browser.
10. Reload one browser and confirm that history restores the same state.
11. Reconnect one browser and confirm that no duplicate action changes the projection.

- [ ] Run the model-failure rehearsal.

Remove or invalidate the AI Gateway key in a preview environment. Repeat the central demo path. Confirm that deterministic fallbacks finish it.

- [ ] Rehearse the 90-second presentation.

Keep only these visible moments: presence, two orders, assignment, station failure, reassignment, ready, and delivery.

- [ ] Run the final verification.

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
```

Expected result: the first four commands pass. The status lists only intended implementation and documentation changes.

- [ ] Stop for user review. Do not stage, commit, push, or deploy production without explicit approval.

## Acceptance Trace

| Product result                | Proof                                           |
| ----------------------------- | ----------------------------------------------- |
| One shared state              | Reducer tests and three-browser test            |
| Several active orders         | Multi-order reducer test and Customer view      |
| Three human roles             | Join screen, role views, and presence           |
| Portal history reconstruction | Portal paging tests and browser reload          |
| Coordinator assignment        | Agent and webhook route tests                   |
| Principal failure             | Reducer test and Manager view                   |
| Backup reassignment           | Multi-order agent test and live demo            |
| Delivery completion           | Agent test and live demo                        |
| Replay safety                 | Duplicate message and action-key tests          |
| Model-independent demo        | Fallback tests and preview rehearsal            |
| Build health                  | `pnpm typecheck`, `pnpm test`, and `pnpm build` |

## Execution Order

Execute Tasks 1 through 6 in order. After Task 3, Tasks 4 and 5 can run in parallel. After Task 6, Tasks 7 and 8 can proceed in sequence. Task 9 is the only live-service gate.

Use a fresh implementation worker for each task when `superpowers:subagent-driven-development` is available. Review every worker diff before the next task. Do not trust a worker completion message without running the listed verification commands.
