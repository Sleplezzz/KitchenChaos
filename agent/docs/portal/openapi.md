# Portal Public API

**Version:** `1.0.0`

The public HTTP surface of the Portal platform.

Portal exposes two hosts:

- **`https://api.useportal.co`** — the control plane. Tenant backends call it
  with a **secret key** (`sk_...`) to mint end-user tokens, publish server
  messages, manage channel membership and bans, send notifications, and deploy
  configuration. One route (`/v1/tokens/anonymous`) also accepts a
  **publishable key** (`pk_...`) so a browser can mint anonymous tokens with no
  backend in the loop.
- **`https://realtime.useportal.co`** — the realtime edge. End-user clients call
  it with a **Portal user JWT** (minted via `/v1/tokens`) to publish messages on
  their own behalf and to read message history and channel rosters.

## Authentication at a glance

- `secretKey` — `Authorization: Bearer sk_...`. Server-only; never send a secret
  key from a browser (requests carrying an `Origin` header are rejected).
- `publishableKey` — `Authorization: Bearer pk_...` **or** the `x-portal-key:
pk_...` header. Browser-safe; accepted only on `/v1/tokens/anonymous`.
- `userToken` — `Authorization: Bearer <jwt>`. A Portal user JWT minted via
  `/v1/tokens` (or `/v1/tokens/anonymous` for anonymous users). Used on the
  realtime host.

The environment a credential belongs to is resolved from the credential itself,
never from the URL.

## Errors

Every non-2xx response has a JSON body `{ code, reason? }` and an
`x-portal-error` response header carrying the same `code`. Read `code` from the
body or the header rather than branching on HTTP status alone — several codes
share a status.

## Excluded from this document

The following are deliberately **not** modeled here:

- **`/internal/*`** — platform-internal surfaces, not callable with customer
  credentials.
- **Dashboard CRUD routes** — Clerk-session-authenticated routes used by the
  Portal dashboard (organization/project/environment/API-key/allowed-origin
  management, the message browser, and the `logs-token` mint's sibling routes).
  The one dashboard route useful to integrators, `POST
/v1/environments/{envId}/logs-token`, is included and flagged below.
- **WebSocket endpoints** (`GET /v1/channels/{id}`, `GET /inbox`, `GET
/v1/environments/{envId}/logs`) — OpenAPI does not model WebSockets. They are
  documented separately as prose, including the connection handshake, frame
  types, and refusal codes.

## Base URLs

- `https://api.useportal.co` — Control plane (tenant backend, secret key).
- `https://realtime.useportal.co` — Realtime edge (end-user client, user JWT).

## Tokens

### Mint an end-user Portal JWT

```http
POST /v1/tokens
```

Mints a signed Portal user JWT for one of your end users. Send the token to
your client; it then connects to the realtime edge and calls client routes
with `Authorization: Bearer <jwt>`.

`claims` is an opaque bag you define — it travels with the token and is
available to your channel config's authorization logic and to message
senders (as read-only metadata). `channels`, when present, restricts the
token to the listed channels and grants; omit it to allow whatever the
channel config permits. `ttl` accepts values like `1h`, `30m`, `45s`,
`2d`, or a bare number of seconds; it defaults to one hour.

Server-only. A request carrying an `Origin` header (a browser) is rejected.

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/MintTokenRequest"
}
```

Example:

```json
{
  "default": {
    "summary": "Mint a 1-hour token for user \"u_123\" with a claims bag",
    "value": {
      "userId": "u_123",
      "claims": {
        "username": "ada",
        "avatar": "https://cdn.example.com/ada.png"
      },
      "ttl": "1h"
    }
  }
}
```

#### Responses

| Status | Description   | Content type     |
| ------ | ------------- | ---------------- |
| `200`  | Token minted. | application/json |
| `400`  | —             | —                |
| `401`  | —             | —                |
| `403`  | —             | —                |

#### Authentication

- Required: `secretKey`

### Mint an anonymous Portal JWT

```http
POST /v1/tokens/anonymous
```

Mints an anonymous user JWT (`claims.anon = true`). Two ways to call it,
both returning the same token shape:

**(a) Secret key — server-side.** Send `Authorization: Bearer sk_...`. You
may set `channels` grants and a custom `ttl`. Browser requests are rejected
(a secret key must never reach a browser).

**(b) Publishable key — browser-side, zero backend.** Send
`Authorization: Bearer pk_...` **or** the `x-portal-key: pk_...` header. The
body may contain **only** `anonId` — `channels` and `ttl` are rejected with
`validation_failed`; the platform default TTL (one hour) and default grants
apply. This path is the only route on the control plane that is
browser-CORS-enabled, scoped to the environment's registered allowed
origins (loopback is always allowed). It is coarsely rate-limited per key.
An Origin that resolves to a real environment but isn't registered for it
gets `403 origin_not_allowed` instead of a token (see the `Forbidden`
response).

`anonId` (optional, both paths) must match the `anon_...` id format
exactly. When present it is reused as the token subject, so an SDK can
re-mint on expiry for the **same** anonymous identity. When absent, a fresh
id is generated and returned as the token subject.

> A browser preflight (`OPTIONS`) never carries the credential's value (only
> the header NAME it intends to send), so the environment can't be resolved
> there — preflight is permissive instead (`204` + ACAO for any Origin).
> Enforcement is entirely on the actual `POST`, where the credential is
> present in a header (`?key=pk_...` also still works there, kept for
> compatibility, though it was never an auth path — only a CORS-resolution
> one).

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/MintAnonymousTokenRequest"
}
```

Example:

```json
{
  "server": {
    "summary": "Server-side mint with a channel grant and 30-minute TTL",
    "value": {
      "channels": {
        "chat-general": ["connect", "publish"]
      },
      "ttl": "30m",
      "anonId": "anon_Vk8v2pBpHx7mJ9sXkFq3Qw"
    }
  },
  "browser": {
    "summary": "Browser mint with a stable anonymous identity",
    "value": {
      "anonId": "anon_Vk8v2pBpHx7mJ9sXkFq3Qw"
    }
  }
}
```

#### Responses

| Status | Description             | Content type     |
| ------ | ----------------------- | ---------------- |
| `200`  | Anonymous token minted. | application/json |
| `400`  | —                       | —                |
| `401`  | —                       | —                |
| `403`  | —                       | —                |
| `429`  | —                       | —                |

#### Authentication

- Required: `secretKey`
- Required: `publishableKey`

## Channels — Admin

### Publish a message to a channel

```http
POST /v1/channels/{channelId}/messages
```

Publishes a message to a channel. The same path serves two distinct callers
on two hosts — the host you target determines how you authenticate and what
the body contains:

- **Control plane (`api.useportal.co`)** — server publish. Authenticate
  with a **secret key** and include `senderId` in the body (the server names
  the sender; there is no user JWT to derive it from). A server publish is
  pre-trusted: it bypasses your channel config's publish middleware and
  authorization, so it always lands. Platform limits still apply (content
  ≤ 2 KB; per-channel rate limit). The notification bridge that your config
  can wire to `notify` does **not** run for a server publish — use
  `/v1/users/{userId}/notifications` to deliver notifications.
- **Realtime edge (`realtime.useportal.co`)** — client publish.
  Authenticate with a **user JWT** and omit `senderId` (the sender is the
  token's subject). A client publish is subject to your channel config's
  authorization and publish middleware, which may block, mask, or defer it.

`content` is opaque to the platform and capped at 2 KB. `kind` defaults to
`text` (the only value in v1). `type` is a userland discriminator (defaults
to `message`). Set `to` to a member's user id to deliver to that one member
only (no broadcast) and write them an inbox item. `mentions` is a list of
`{ userId }` declared by the sender; the platform verifies each is a member,
dedupes, and caps the count.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "oneOf": [
    {
      "$ref": "#/components/schemas/ServerPublishRequest"
    },
    {
      "$ref": "#/components/schemas/ClientPublishRequest"
    }
  ],
  "description": "Use `ServerPublishRequest` on the control plane (with a secret key)\nand `ClientPublishRequest` on the realtime edge (with a user JWT).\n"
}
```

Example:

```json
{
  "server": {
    "summary": "Server publish on the control plane",
    "value": {
      "senderId": "server",
      "type": "system",
      "content": {
        "text": "Welcome to the channel!"
      },
      "kind": "text"
    }
  },
  "client": {
    "summary": "Client publish on the realtime edge",
    "value": {
      "type": "message",
      "content": {
        "text": "hello world"
      },
      "kind": "text",
      "mentions": [
        {
          "userId": "u_456"
        }
      ]
    }
  }
}
```

#### Responses

| Status | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Content type     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `200`  | Message accepted and persisted. The ack confirms storage — a later retraction can still modify it.                                                                                                                                                                                                                                                                                                                                                                                                                      | application/json |
| `400`  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                |
| `401`  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                |
| `403`  | Forbidden. `forbidden` (secret key used from a browser, or a publishable key on a secret-only path), `not_permitted` (your config's authorization denied the publish or the direct send), `banned` (the sender is banned from this channel), `not_member` (a `to:` recipient is not a channel member), or `origin_not_allowed` (client hot-path only — the caller's browser Origin resolved to a real environment but isn't on its allowed-origins list; carries ACAO for that same Origin so the message is readable). | application/json |
| `413`  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                |
| `422`  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                |
| `429`  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                |

#### Authentication

- Required: `secretKey`
- Required: `userToken`

### Add member(s) to a channel

```http
POST /v1/channels/{channelId}/members
```

Adds one or more members to a **standard** channel. Upsert and idempotent:
re-adding an existing member updates their `claims` and is not an error.
Membership may precede any connection — the channel appears in each added
user's inbox immediately.

Send either a single `{ userId, claims? }` or a batch `{ members: [...] }`
(up to 100 members per request). `claims` is an optional display snapshot
(for example `username`, `avatar`) recorded at add time; a row otherwise
fills in when the user first connects.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "oneOf": [
    {
      "$ref": "#/components/schemas/AddMemberSingle"
    },
    {
      "$ref": "#/components/schemas/AddMemberBatch"
    }
  ],
  "description": "Send a single member or a batch."
}
```

Example:

```json
{
  "single": {
    "summary": "Add one member with a display snapshot",
    "value": {
      "userId": "u_456",
      "claims": {
        "username": "grace"
      }
    }
  },
  "batch": {
    "summary": "Add several members at once",
    "value": {
      "members": [
        {
          "userId": "u_456",
          "claims": {
            "username": "grace"
          }
        },
        {
          "userId": "u_789"
        }
      ]
    }
  }
}
```

#### Responses

| Status | Description    | Content type     |
| ------ | -------------- | ---------------- |
| `200`  | Members added. | application/json |
| `400`  | —              | —                |
| `401`  | —              | —                |
| `403`  | —              | —                |

#### Authentication

- Required: `secretKey`

### Remove a member from a channel

```http
DELETE /v1/channels/{channelId}/members/{userId}
```

Removes a member from a standard channel (a leave or a removal — the same
operation). Idempotent: removing someone who is not a member is not an
error. The user's inbox row for this channel is removed with the membership.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |
| ``   |     | —    | no       | —           |

#### Responses

| Status | Description                             | Content type     |
| ------ | --------------------------------------- | ---------------- |
| `200`  | Member removed (or was already absent). | application/json |
| `401`  | —                                       | —                |
| `403`  | —                                       | —                |

#### Authentication

- Required: `secretKey`

### Ban a user from a channel

```http
POST /v1/channels/{channelId}/bans
```

Bans a user from a channel. Any live connection for that user on this
channel is force-disconnected. A ban is independent of membership — banning
does not remove the member row, so combine a ban with a remove if you want
both kick and lock. `expiresAt` (ISO 8601) is optional; omit it for a ban
that does not auto-expire.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/BanRequest"
}
```

Example:

```json
{
  "default": {
    "summary": "Ban a user with an expiry",
    "value": {
      "userId": "u_456",
      "expiresAt": "2026-08-19T00:00:00.000Z"
    }
  }
}
```

#### Responses

| Status | Description   | Content type     |
| ------ | ------------- | ---------------- |
| `200`  | Ban recorded. | application/json |
| `400`  | —             | —                |
| `401`  | —             | —                |
| `403`  | —             | —                |

#### Authentication

- Required: `secretKey`

### Lift a ban

```http
DELETE /v1/channels/{channelId}/bans/{userId}
```

Removes a ban. Idempotent. Lifting a ban does not restore any prior state —
it simply allows the user to connect and publish again, subject to your
channel config's normal authorization.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |
| ``   |     | —    | no       | —           |

#### Responses

| Status | Description                         | Content type     |
| ------ | ----------------------------------- | ---------------- |
| `200`  | Ban lifted (or was already absent). | application/json |
| `401`  | —                                   | —                |
| `403`  | —                                   | —                |

#### Authentication

- Required: `secretKey`

## Channels — Client

### List channel members

```http
GET /v1/channels/{channelId}/members
```

Returns the member directory of a **standard** channel, with each member's
`online` state merged from live presence. This is a fetched directory, not
live presence updates — subscribe to the channel WebSocket for live joins
and leaves. Keyset-paged by `cursor`; `cursor` is absent on the last page.

Broadcast channels have no membership concept and return `404
not_membership_channel`. Browser CORS is enabled for this route, scoped to
the environment's allowed origins. `limit` defaults to 100 and is capped at 500.

#### Parameters

| Name     | In    | Type      | Required | Description                                                                  |
| -------- | ----- | --------- | -------- | ---------------------------------------------------------------------------- |
| ``       |       | —         | no       | —                                                                            |
| `cursor` | query | `string`  | no       | Opaque keyset cursor returned by the previous page; absent on the last page. |
| `limit`  | query | `integer` | no       | Page size (default 100, max 500).                                            |

#### Responses

| Status | Description        | Content type     |
| ------ | ------------------ | ---------------- |
| `200`  | A page of members. | application/json |
| `401`  | —                  | —                |
| `403`  | —                  | —                |
| `404`  | —                  | —                |

#### Authentication

- Required: `userToken`

### Read message history

```http
GET /v1/channels/{channelId}/history
```

Returns message history for a channel. One endpoint serves two paging
styles:

- **Scroll-up paging** — `?before={seq}&limit={n}`. Returns messages older
  than `before`, ascending (oldest first), up to `limit` (default 50, max
  100). Omit `before` to start from the newest.
- **Gap-fill range** — `?from={seq}&to={seq}`. Returns messages in the
  inclusive `[from, to]` sequence range, ascending.

The response is `{ msgs, hasMore }`. Retracted messages come back as
tombstoned envelopes (`retracted: true`, `content: null`). Browser CORS is
enabled for this route, scoped to the environment's allowed origins.

#### Parameters

| Name     | In    | Type      | Required | Description                                                         |
| -------- | ----- | --------- | -------- | ------------------------------------------------------------------- |
| ``       |       | —         | no       | —                                                                   |
| `before` | query | `integer` | no       | Return messages with `seq` less than this value (scroll-up paging). |
| `from`   | query | `integer` | no       | Inclusive lower bound of a gap-fill range (use with `to`).          |
| `to`     | query | `integer` | no       | Inclusive upper bound of a gap-fill range (use with `from`).        |
| `limit`  | query | `integer` | no       | Page size for scroll-up paging (default 50, max 100).               |

#### Responses

| Status | Description                                        | Content type     |
| ------ | -------------------------------------------------- | ---------------- |
| `200`  | A page of messages and whether more are available. | application/json |
| `401`  | —                                                  | —                |
| `403`  | —                                                  | —                |

#### Authentication

- Required: `userToken`

## Notifications

### Send a notification to a user

```http
POST /v1/users/{userId}/notifications
```

Delivers a notification to a single user as an inbox item, with a live push
if the user is currently connected. Works for users who have never
connected (the inbox is created lazily). No batching and no external
destinations in v1 — delivery is to the Portal inbox only.

Send an `idempotency-key` header to make the send idempotent: the same key
always returns the same item id and creates the item at most once.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/NotifyRequest"
}
```

Example:

```json
{
  "default": {
    "summary": "A \"ticket.assigned\" notification with a payload",
    "value": {
      "type": "ticket.assigned",
      "title": "Ticket",
      "data": {
        "ticketId": "128",
        "channelId": "tkt-128"
      }
    }
  }
}
```

#### Responses

| Status | Description                                                                                        | Content type     |
| ------ | -------------------------------------------------------------------------------------------------- | ---------------- |
| `200`  | Notification delivered. The id is the inbox item id (or the idempotency key, if you supplied one). | application/json |
| `400`  | —                                                                                                  | —                |
| `401`  | —                                                                                                  | —                |
| `403`  | —                                                                                                  | —                |

#### Authentication

- Required: `secretKey`

## Deploys

### List deploys

```http
GET /v1/deploys
```

Returns the deploy audit trail for the environment (newest first), including
both `deploy` and `rollback` actions. `limit` defaults to 50 and is capped
at 100.

#### Parameters

| Name    | In    | Type      | Required | Description                                 |
| ------- | ----- | --------- | -------- | ------------------------------------------- |
| `limit` | query | `integer` | no       | Maximum number of deploy records to return. |

#### Responses

| Status | Description         | Content type     |
| ------ | ------------------- | ---------------- |
| `200`  | Deploy audit trail. | application/json |
| `401`  | —                   | —                |
| `403`  | —                   | —                |

#### Authentication

- Required: `secretKey`

### Upload a config version

```http
POST /v1/deploys
```

Validates and uploads a new configuration version, returning its
content-addressed `versionId`. The version is **inactive** until you call
`/v1/deploys/{versionId}/activate`.

`extract` is the declarative configuration (see the schema). `hookScript`
and `extensionScripts` carry the bundled code your config references, if
any. Re-uploading identical content returns `409 version_exists` — treat it
as success client-side (the existing `versionId` is stable).

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/DeployRequest"
}
```

Example:

```json
{
  "default": {
    "summary": "A minimal config with one standard channel",
    "value": {
      "extract": {
        "version": "1",
        "project": {
          "webhooks": null
        },
        "channels": {
          "chat-general": {
            "mode": "standard",
            "anonymous": true,
            "hooks": {
              "authz": true,
              "onPublish": 1,
              "notify": false
            },
            "extensions": {}
          }
        }
      }
    }
  }
}
```

#### Responses

| Status | Description                  | Content type     |
| ------ | ---------------------------- | ---------------- |
| `200`  | Version uploaded (inactive). | application/json |
| `400`  | —                            | —                |
| `401`  | —                            | —                |
| `403`  | —                            | —                |
| `409`  | —                            | —                |

#### Authentication

- Required: `secretKey`

### Activate a config version

```http
POST /v1/deploys/{versionId}/activate
```

Points the environment's active configuration at the given version. A
newly-connected channel picks up the active config on its next load;
channels already connected keep their previously-loaded config until they
reconnect. Activating an older version is a rollback.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Responses

| Status | Description        | Content type     |
| ------ | ------------------ | ---------------- |
| `200`  | Version activated. | application/json |
| `401`  | —                  | —                |
| `403`  | —                  | —                |
| `404`  | —                  | —                |

#### Authentication

- Required: `secretKey`

### Get the active config

```http
GET /v1/configs/active
```

Returns the environment's currently active configuration version: its
`versionId`, the full `extract`, and when it was activated.

#### Responses

| Status | Description               | Content type     |
| ------ | ------------------------- | ---------------- |
| `200`  | The active configuration. | application/json |
| `401`  | —                         | —                |
| `403`  | —                         | —                |
| `404`  | —                         | —                |

#### Authentication

- Required: `secretKey`

## Secrets

### Set a secret value

```http
PUT /v1/secrets/{name}
```

Sets a runtime secret for your deployed config. The value is injected into
your config's runtime environment; only the secret's **name** and
timestamps are stored in the control plane — the value itself is never
persisted there and is never listed by `GET /v1/secrets`.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Request body

**application/json**

```json
{
  "$ref": "#/components/schemas/PutSecretRequest"
}
```

Example:

```json
{
  "default": {
    "summary": "Set a third-party API token",
    "value": {
      "value": "sk_live_abc123..."
    }
  }
}
```

#### Responses

| Status | Description    | Content type     |
| ------ | -------------- | ---------------- |
| `200`  | Secret stored. | application/json |
| `400`  | —              | —                |
| `401`  | —              | —                |
| `403`  | —              | —                |

#### Authentication

- Required: `secretKey`

### Delete a secret

```http
DELETE /v1/secrets/{name}
```

Removes a runtime secret. Idempotent. After deletion, the value is no longer
available to your config's runtime.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Responses

| Status | Description                             | Content type     |
| ------ | --------------------------------------- | ---------------- |
| `200`  | Secret removed (or was already absent). | application/json |
| `401`  | —                                       | —                |
| `403`  | —                                       | —                |

#### Authentication

- Required: `secretKey`

### List secret names

```http
GET /v1/secrets
```

Returns the names of the runtime secrets set for the environment, with
timestamps. **Never** returns secret values.

#### Responses

| Status | Description                  | Content type     |
| ------ | ---------------------------- | ---------------- |
| `200`  | Secret names and timestamps. | application/json |
| `401`  | —                            | —                |
| `403`  | —                            | —                |

#### Authentication

- Required: `secretKey`

## Webhooks

### List webhook delivery attempts

```http
GET /v1/webhooks/deliveries
```

Returns the webhook delivery ledger for the environment resolved from the
secret key. Each row represents one event (`message.published` or
`message.retracted`) relayed to the configured webhook endpoint, with its
current status (`pending`, `delivered`, or `dropped`), attempt count, and
last error (if any). Newest first.

The ledger IS the dead-letter store: a delivery that exhausts its retry
schedule (30s / 5m / 30m / 2h / 6h) is marked `dropped` with `lastError`.
Delivered and dropped rows are retained for approximately 7 days.

Webhook delivery is configured via the `project.webhooks` block in
`portal.config.ts`. A per-environment signing secret is minted on first
activation of a webhook-bearing config; verify deliveries with
`GET /v1/webhooks/secret` and the `portal-signature` header.

#### Parameters

| Name     | In    | Type      | Required | Description                                                   |
| -------- | ----- | --------- | -------- | ------------------------------------------------------------- |
| `status` | query | `string`  | no       | Filter by delivery status.                                    |
| `limit`  | query | `integer` | no       | Maximum number of deliveries to return (default 50, max 500). |

#### Responses

| Status | Description                            | Content type     |
| ------ | -------------------------------------- | ---------------- |
| `200`  | Delivery ledger entries, newest first. | application/json |
| `401`  | —                                      | —                |
| `403`  | —                                      | —                |

#### Authentication

- Required: `secretKey`

### Get the webhook signing secret

```http
GET /v1/webhooks/secret
```

Returns the per-environment HMAC signing secret used to sign webhook
deliveries. The secret is minted automatically on the first activation of
a webhook-bearing config version and is stable across subsequent
activations.

**Verify a delivery** by computing
`HMAC-SHA256(secret, "{t}.{rawBody}")` and comparing the hex digest to the
`v1` value in the `portal-signature` header (`t=<unix-seconds>,v1=<hex>`).

#### Responses

| Status | Description                                                             | Content type     |
| ------ | ----------------------------------------------------------------------- | ---------------- |
| `200`  | The webhook signing secret.                                             | application/json |
| `401`  | —                                                                       | —                |
| `403`  | —                                                                       | —                |
| `404`  | No webhook secret found for this environment (webhooks not configured). | application/json |

#### Authentication

- Required: `secretKey`

## Dashboard

### Mint a short-lived live-activity token (dashboard session)

```http
POST /v1/environments/{envId}/logs-token
```

Mints a short-lived, analytics-scoped Portal JWT used to open the
environment's live-activity WebSocket on the realtime edge. **Dashboard
session auth** — this route is authenticated with a Clerk dashboard session
(the same session the Portal dashboard uses), **not** with a secret key,
and the caller must belong to the organization that owns the environment.

> **Flagged in the PR:** OpenAPI's `http bearer` scheme does not cleanly
> model a browser-cookie dashboard session, so this operation is described
> with a `dashboard-session` security scheme (documentation-only — it
> carries no header a client sends programmatically). Integrators building
> custom dashboards should use the Portal dashboard instead of calling this
> route directly. The token has a fixed 15-minute TTL and an `analytics`
> scope; it is refused on channel and inbox routes.

#### Parameters

| Name | In  | Type | Required | Description |
| ---- | --- | ---- | -------- | ----------- |
| ``   |     | —    | no       | —           |

#### Responses

| Status | Description             | Content type     |
| ------ | ----------------------- | ---------------- |
| `200`  | Analytics token minted. | application/json |
| `401`  | —                       | —                |
| `403`  | —                       | —                |
| `404`  | —                       | —                |

#### Authentication

- Required: `dashboardSession`

## CLI Authentication

### Begin a CLI login

```http
POST /v1/device/start
```

Starts a device-authorization request. **No authentication** — the caller
is a CLI that has no credential yet, which is the point of the flow; the
route is rate-limited per IP instead.

Returns two codes with different jobs. The `deviceCode` is high-entropy,
stays on the machine, and is the credential for `POST /v1/device/poll`.
The `userCode` is short enough to read off a terminal and retype in a
browser at `verificationUri`. Both die after `expiresIn` seconds.

#### Request body

**application/json**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Label for the machine logging in, shown to the person approving. Typically the hostname.",
      "example": "rodrigo-macbook"
    }
  }
}
```

Example:

```json
null
```

#### Responses

| Status | Description                   | Content type     |
| ------ | ----------------------------- | ---------------- |
| `200`  | Device authorization started. | application/json |
| `400`  | —                             | —                |
| `429`  | —                             | —                |

### Poll for the result of a CLI login

```http
POST /v1/device/poll
```

Asks whether the person has approved yet. **No authentication** — the
`deviceCode` is itself the credential.

Poll no faster than the `interval` returned by `/v1/device/start`;
polling early returns `429` with `reason: "slow_down"`, and the client
should increase its interval before trying again.

**The token is returned exactly once.** The first poll after approval
creates the CLI token and returns it; every later poll returns
`{"status": "approved"}` with no `token` field. There is no way to
retrieve it again — a client that loses it must start a new login.

#### Request body

**application/json**

```json
{
  "type": "object",
  "required": ["deviceCode"],
  "properties": {
    "deviceCode": {
      "type": "string",
      "description": "The device code from `/v1/device/start`."
    }
  }
}
```

Example:

```json
null
```

#### Responses

| Status | Description                                                       | Content type     |
| ------ | ----------------------------------------------------------------- | ---------------- |
| `200`  | The current state of the request.                                 | application/json |
| `400`  | —                                                                 | —                |
| `404`  | —                                                                 | —                |
| `429`  | Polled faster than the advertised `interval`. Back off and retry. | application/json |

### Describe a pending CLI login (Clerk session only)

```http
POST /v1/device/lookup
```

Resolves a `userCode` to what it would authorize, so the dashboard can
name the machine before asking the person to decide. **Clerk dashboard
session only** — a CLI token (`pcli_...`) is rejected with `403
forbidden`. See `POST /v1/device/approve` for why.

Returns only the CLI-supplied label and the deadline; it never exposes
the device code. The `userCode` may be sent in any case, with or without
the display hyphen.

#### Request body

**application/json**

```json
{
  "type": "object",
  "required": ["userCode"],
  "properties": {
    "userCode": {
      "type": "string",
      "example": "K7WQ-3MTD"
    }
  }
}
```

Example:

```json
null
```

#### Responses

| Status | Description                                                                                                   | Content type     |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| `200`  | The pending request.                                                                                          | application/json |
| `401`  | —                                                                                                             | —                |
| `403`  | The caller authenticated with a `pcli_` CLI token. Only a Clerk dashboard session may preview a device login. | application/json |
| `404`  | No live request has that code — unknown, expired, or already decided.                                         | application/json |
| `429`  | —                                                                                                             | —                |

#### Authentication

- Required: `dashboardSession`

### Approve or deny a CLI login (Clerk session only)

```http
POST /v1/device/approve
```

Records the person's decision. **Clerk dashboard session only** —
approving grants the CLI a token that acts as **the calling user**,
with the same organization access they have in the dashboard, so this
must be called by the human who is logging in from a live browser
session.

A `pcli_` CLI token is rejected here with `403 forbidden`, even one
belonging to the same user. This is deliberate: accepting a CLI token
would let it approve its own logins, minting fresh 90-day siblings
with no human involved and defeating both the TTL and
`DELETE /v1/cli-tokens`. This is the one dashboard route where a Clerk
session and a CLI token do **not** carry identical authority (see
`dashboardSession` vs `cliToken` above).

A decision is final: once a request is approved or denied, the same
`userCode` returns `404` on any further call. Approval does not itself
mint the token — the CLI's next poll does.

> **Approve only a code you generated yourself.** Like every device
> grant (RFC 8628 §5.4), this flow cannot bind the machine that started
> the login to the person who approves it — the only channel between
> them is a code a human carries. Anyone who persuades you to approve
> their code receives a 90-day credential acting as **you**, with your
> full organization access. A UI built on this route must state that
> consequence plainly and show `requestedFrom` from
> `/v1/device/lookup`.

#### Request body

**application/json**

```json
{
  "type": "object",
  "required": ["userCode", "approve"],
  "properties": {
    "userCode": {
      "type": "string",
      "example": "K7WQ-3MTD"
    },
    "approve": {
      "type": "boolean",
      "description": "True to authorize the CLI, false to reject it."
    }
  }
}
```

Example:

```json
null
```

#### Responses

| Status | Description                                                                                                                                                         | Content type     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `200`  | The decision was recorded.                                                                                                                                          | application/json |
| `400`  | —                                                                                                                                                                   | —                |
| `401`  | —                                                                                                                                                                   | —                |
| `403`  | The caller authenticated with a `pcli_` CLI token. A CLI has no legitimate reason to approve its own (or anyone else's) login — only a Clerk dashboard session may. | application/json |
| `404`  | No live request has that code — unknown, expired, or already decided.                                                                                               | application/json |
| `429`  | —                                                                                                                                                                   | —                |

#### Authentication

- Required: `dashboardSession`

### Revoke the calling CLI token

```http
DELETE /v1/cli-tokens/current
```

Revokes the CLI token used to make this request — what `portal logout`
calls. It takes no id and cannot reach any other token, so it can never
sign out a different machine.

Requires a CLI token. A Clerk dashboard session has no "current token"
and is rejected with `validation_failed`. See `DELETE /v1/cli-tokens`
to revoke every token on the account instead of just this one.

#### Responses

| Status | Description                                           | Content type     |
| ------ | ----------------------------------------------------- | ---------------- |
| `200`  | The token is revoked and will no longer authenticate. | application/json |
| `400`  | —                                                     | —                |
| `401`  | —                                                     | —                |

#### Authentication

- Required: `cliToken`

### Revoke every CLI token on the account

```http
DELETE /v1/cli-tokens
```

Revokes every `cli_tokens` row owned by the calling user — not just the
one making this request. Idempotent: a call with nothing left to
revoke returns `{ "revoked": 0 }`.

Takes **either** credential type deliberately, for two different jobs:
a Clerk dashboard session uses it to evict a compromised CLI fleet; a
`pcli_` token uses it to self-destruct along with its siblings (the
`portal logout --all` case) — this is safe because the route is
destructive-only, it cannot mint a credential, so a leaked token
gains no new capability by being allowed to call it.

#### Responses

| Status | Description                   | Content type     |
| ------ | ----------------------------- | ---------------- |
| `200`  | How many tokens were revoked. | application/json |
| `401`  | —                             | —                |

#### Authentication

- Required: `dashboardSession`
- Required: `cliToken`

## Data models

### ErrorCode

```json
{
  "type": "string",
  "description": "An error code. The control plane returns the first group; the realtime edge\nadditionally returns `invalid_token`, `token_expired`, and `not_member` on\nthe routes included here. `origin_not_allowed` (403) is returned by BOTH\nhosts to a browser whose Origin isn't registered for the resolved\nenvironment (`POST /v1/tokens/anonymous` on the control plane; the client\nhot-path publish/history/members routes on the realtime edge) — `reason`\nnames the exact origin and the fix (`portal origins add <origin> --env\n<envId>`). Unlike other errors, this response always carries\n`Access-Control-Allow-Origin` for the request's own (unregistered) Origin,\nor a browser couldn't read the message either.\n",
  "enum": [
    "unauthorized",
    "forbidden",
    "not_found",
    "validation_failed",
    "conflict",
    "rate_limited",
    "content_too_large",
    "not_permitted",
    "banned",
    "blocked_by_middleware",
    "not_membership_channel",
    "version_exists",
    "origin_not_allowed",
    "invalid_token",
    "token_expired",
    "not_member"
  ]
}
```

### ErrorEnvelope

```json
{
  "type": "object",
  "required": ["code"],
  "properties": {
    "code": {
      "$ref": "#/components/schemas/ErrorCode"
    },
    "reason": {
      "type": "string",
      "description": "A human-readable explanation. Absent when the code is self-explanatory."
    }
  },
  "additionalProperties": false
}
```

### Empty

```json
{
  "type": "object",
  "description": "An empty JSON object.",
  "additionalProperties": false,
  "example": {}
}
```

### ChannelGrants

```json
{
  "type": "object",
  "description": "A map of channel id to a list of granted capabilities (for example\n`[\"connect\", \"publish\"]`). Omit on a token to allow whatever the channel\nconfig permits.\n",
  "additionalProperties": {
    "type": "array",
    "items": {
      "type": "string"
    }
  },
  "example": {
    "chat-general": ["connect", "publish"]
  }
}
```

### MintTokenRequest

```json
{
  "type": "object",
  "required": ["userId"],
  "properties": {
    "userId": {
      "type": "string",
      "description": "Your end user's id. Becomes the JWT `sub`."
    },
    "claims": {
      "type": "object",
      "description": "Opaque claims bag; travels with the token and is visible to your config's authorization logic.",
      "additionalProperties": true
    },
    "channels": {
      "$ref": "#/components/schemas/ChannelGrants"
    },
    "ttl": {
      "type": "string",
      "description": "Token lifetime. Accepts `1h`, `30m`, `45s`, `2d`, or a bare number of\nseconds. Defaults to one hour.\n",
      "example": "1h"
    }
  },
  "additionalProperties": false
}
```

### MintAnonymousTokenRequest

```json
{
  "type": "object",
  "properties": {
    "channels": {
      "$ref": "#/components/schemas/ChannelGrants",
      "description": "Secret-key path only. Rejected on the publishable-key path."
    },
    "ttl": {
      "type": "string",
      "description": "Secret-key path only. Rejected on the publishable-key path.",
      "example": "30m"
    },
    "anonId": {
      "type": "string",
      "pattern": "^anon_[A-Za-z0-9_-]{22}$",
      "description": "Optional, both paths. Must match the `anon_...` id format exactly. When\npresent, it is reused as the token subject so an SDK can re-mint on\nexpiry for the same anonymous identity. When absent, a fresh id is\ngenerated.\n",
      "example": "anon_Vk8v2pBpHx7mJ9sXkFq3Qw"
    }
  },
  "additionalProperties": false
}
```

### TokenResponse

```json
{
  "type": "object",
  "required": ["token", "expiresAt"],
  "properties": {
    "token": {
      "type": "string",
      "description": "The signed Portal JWT."
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "description": "Token expiry (RFC 3339)."
    }
  },
  "additionalProperties": false
}
```

### DeviceStartResponse

```json
{
  "type": "object",
  "required": [
    "deviceCode",
    "userCode",
    "verificationUri",
    "interval",
    "expiresIn"
  ],
  "properties": {
    "deviceCode": {
      "type": "string",
      "description": "The CLI's half of the request. High-entropy, stored hashed\nserver-side, and never shown to a person — keep it on the machine and\nsend it only to `/v1/device/poll`.\n"
    },
    "userCode": {
      "type": "string",
      "description": "The half a person retypes in the browser. Eight characters from an\nalphabet with no lookalike pairs; display it grouped (`ABCD-EFGH`)\nfor readability — the server accepts either form, in any case.\n",
      "example": "K7WQ3MTD"
    },
    "verificationUri": {
      "type": "string",
      "format": "uri",
      "description": "Where to send the person to approve. Append `?code={userCode}` to prefill it."
    },
    "interval": {
      "type": "integer",
      "description": "Seconds to wait between polls. Polling faster returns `429 slow_down`.",
      "example": 5
    },
    "expiresIn": {
      "type": "integer",
      "description": "Seconds until the request can no longer be approved.",
      "example": 600
    }
  },
  "additionalProperties": false
}
```

### DevicePollResponse

```json
{
  "type": "object",
  "required": ["status"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["pending", "approved", "denied", "expired"],
      "description": "`pending` — keep polling. `approved` — the person authorized the CLI.\n`denied` — they declined. `expired` — nobody acted in time.\n"
    },
    "token": {
      "type": "string",
      "description": "The CLI token (`pcli_...`). Present ONLY on the first poll after\napproval, and never retrievable again — store it immediately.\n"
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the CLI token expires (90 days out). Present with `token`."
    }
  },
  "additionalProperties": false
}
```

### Mention

```json
{
  "type": "object",
  "required": ["userId"],
  "properties": {
    "userId": {
      "type": "string",
      "description": "The mentioned user's id, or the platform tokens `@everyone` / `@channel` (membership channels, capability-gated, rate-limited)."
    }
  },
  "additionalProperties": false
}
```

### ServerPublishRequest

```json
{
  "type": "object",
  "required": ["senderId", "content"],
  "description": "Server publish body — used on the control plane with a secret key.\nPre-trusted: bypasses your config's publish middleware and authorization.\n",
  "properties": {
    "senderId": {
      "type": "string",
      "description": "The sender's user id. Required on the server path (there is no user JWT to derive it from)."
    },
    "type": {
      "type": "string",
      "description": "Userland discriminator. Defaults to `message`.",
      "default": "message"
    },
    "content": {
      "description": "The message payload. Opaque to the platform; ≤ 2 KB."
    },
    "kind": {
      "type": "string",
      "description": "Content class. Defaults to `text` (the only value in v1).",
      "default": "text"
    },
    "to": {
      "type": "string",
      "description": "A member's user id. Set this to deliver to that member only (no broadcast) and write them an inbox item."
    },
    "mentions": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Mention"
      },
      "description": "Declared mentions. The platform verifies each is a member, dedupes, and caps the count."
    }
  },
  "additionalProperties": false
}
```

### ClientPublishRequest

```json
{
  "type": "object",
  "required": ["content"],
  "description": "Client publish body — used on the realtime edge with a user JWT. The sender\nis the token's subject (omit `senderId`). Subject to your config's\nauthorization and publish middleware.\n",
  "properties": {
    "type": {
      "type": "string",
      "description": "Userland discriminator. Defaults to `message`.",
      "default": "message"
    },
    "content": {
      "description": "The message payload. Opaque to the platform; ≤ 2 KB."
    },
    "kind": {
      "type": "string",
      "description": "Content class. Defaults to `text` (the only value in v1).",
      "default": "text"
    },
    "to": {
      "type": "string",
      "description": "A member's user id. Set this to deliver to that member only (no broadcast) and write them an inbox item."
    },
    "mentions": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Mention"
      },
      "description": "Declared mentions. The platform verifies each is a member, dedupes, and caps the count."
    }
  },
  "additionalProperties": false
}
```

### SendAck

```json
{
  "type": "object",
  "required": ["id", "seq", "timestamp"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Platform-assigned message id. Unique within the channel."
    },
    "seq": {
      "type": "integer",
      "description": "Per-channel sequence number, contiguous within a connection's delivery stream."
    },
    "timestamp": {
      "type": "integer",
      "description": "Epoch milliseconds (platform clock)."
    }
  },
  "additionalProperties": false
}
```

### WireSender

```json
{
  "type": "object",
  "required": ["id", "anon"],
  "properties": {
    "id": {
      "type": "string",
      "description": "The sender's user id (or anonymous id)."
    },
    "anon": {
      "type": "boolean",
      "description": "Whether the sender is anonymous."
    },
    "username": {
      "type": "string",
      "description": "Populated on broadcast channels only (they have no roster to join against)."
    }
  },
  "additionalProperties": false
}
```

### WireMessage

```json
{
  "type": "object",
  "required": [
    "id",
    "seq",
    "type",
    "kind",
    "content",
    "sender",
    "timestamp",
    "retracted",
    "ephemeral"
  ],
  "description": "The message envelope. Retracted messages come back with `retracted: true`\nand `content: null` (a tombstone). Ephemeral messages are not persisted and\ncarry `seq: null` (they are not returned by history).\n",
  "properties": {
    "id": {
      "type": "string",
      "description": "Platform-assigned message id. Unique within the channel."
    },
    "seq": {
      "type": ["integer", "null"],
      "description": "Per-channel sequence number, or `null` for ephemeral messages."
    },
    "type": {
      "type": "string",
      "description": "Userland discriminator."
    },
    "kind": {
      "type": "string",
      "description": "Content class (`text` in v1)."
    },
    "content": {
      "description": "The message payload, opaque to the platform. Any JSON value, including `null` for retracted messages."
    },
    "sender": {
      "$ref": "#/components/schemas/WireSender"
    },
    "timestamp": {
      "type": "integer",
      "description": "Epoch milliseconds."
    },
    "to": {
      "type": "string",
      "description": "Present when the message was delivered to a single recipient (`to:`-send)."
    },
    "mentions": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/Mention"
      }
    },
    "retracted": {
      "type": "boolean",
      "description": "Whether the message was retracted after publish."
    },
    "ephemeral": {
      "type": "boolean",
      "description": "Whether the message is ephemeral (not persisted, no `seq`)."
    }
  },
  "additionalProperties": false
}
```

### HistoryResponse

```json
{
  "type": "object",
  "required": ["msgs", "hasMore"],
  "properties": {
    "msgs": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/WireMessage"
      }
    },
    "hasMore": {
      "type": "boolean",
      "description": "Whether an older page is available (scroll-up paging)."
    }
  },
  "additionalProperties": false
}
```

### MemberRow

```json
{
  "type": "object",
  "required": ["userId", "online", "claims"],
  "properties": {
    "userId": {
      "type": "string"
    },
    "online": {
      "type": "boolean",
      "description": "Whether the member is currently connected (merged from live presence)."
    },
    "claims": {
      "type": "object",
      "description": "The join-time claims snapshot.",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

### MembersResponse

```json
{
  "type": "object",
  "required": ["members"],
  "properties": {
    "members": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/MemberRow"
      }
    },
    "cursor": {
      "type": "string",
      "description": "Keyset cursor for the next page; absent on the last page."
    }
  },
  "additionalProperties": false
}
```

### AddMemberSingle

```json
{
  "type": "object",
  "required": ["userId"],
  "properties": {
    "userId": {
      "type": "string"
    },
    "claims": {
      "type": "object",
      "description": "Optional display snapshot (for example `username`, `avatar`).",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

### AddMemberBatch

```json
{
  "type": "object",
  "required": ["members"],
  "properties": {
    "members": {
      "type": "array",
      "minItems": 1,
      "maxItems": 100,
      "items": {
        "$ref": "#/components/schemas/AddMemberSingle"
      }
    }
  },
  "additionalProperties": false
}
```

### AddMembersResponse

```json
{
  "type": "object",
  "required": ["added"],
  "properties": {
    "added": {
      "type": "integer",
      "description": "The number of members added (upserts of existing members count)."
    }
  },
  "additionalProperties": false
}
```

### BanRequest

```json
{
  "type": "object",
  "required": ["userId"],
  "properties": {
    "userId": {
      "type": "string"
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "description": "Optional ban expiry (RFC 3339). Omit for a ban that does not auto-expire."
    }
  },
  "additionalProperties": false
}
```

### NotifyRequest

```json
{
  "type": "object",
  "required": ["type"],
  "properties": {
    "type": {
      "type": "string",
      "description": "Userland notification type (for example `ticket.assigned`, `mention`)."
    },
    "title": {
      "type": "string",
      "description": "Optional human-readable title."
    },
    "data": {
      "description": "Optional userland payload, opaque to the platform."
    }
  },
  "additionalProperties": false
}
```

### NotifyResponse

```json
{
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "The inbox item id (or the idempotency key, if you supplied one)."
    }
  },
  "additionalProperties": false
}
```

### HooksManifest

```json
{
  "type": "object",
  "description": "What hooks a channel's config references (capabilities only, never code).",
  "properties": {
    "authz": {
      "type": "boolean",
      "description": "Whether the channel runs custom authorization on connect/publish."
    },
    "onPublish": {
      "type": "integer",
      "description": "The number of `onPublish` hooks in the chain."
    },
    "onDisconnect": {
      "type": "integer",
      "description": "The number of `onDisconnect` hooks."
    },
    "notify": {
      "type": "boolean",
      "description": "Whether a `notify` hook is wired."
    }
  },
  "additionalProperties": false
}
```

### ExtensionManifest

```json
{
  "type": "object",
  "required": ["script", "namespace", "transport"],
  "description": "A channel extension attachment.",
  "properties": {
    "script": {
      "type": "string",
      "description": "The bundled extension script name."
    },
    "namespace": {
      "type": "string",
      "description": "The extension namespace (for example `poll.`)."
    },
    "transport": {
      "type": "string",
      "description": "The extension transport (for example `ws`)."
    }
  },
  "additionalProperties": false
}
```

### ChannelConfig

```json
{
  "type": "object",
  "required": ["mode", "anonymous", "hooks", "extensions"],
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["standard", "broadcast"],
      "description": "Channel mode. `standard` has a roster and presence; `broadcast` does not."
    },
    "anonymous": {
      "type": "boolean",
      "description": "Whether anonymous users may connect."
    },
    "hooks": {
      "$ref": "#/components/schemas/HooksManifest"
    },
    "extensions": {
      "type": "object",
      "description": "Extensions attached to this channel, keyed by handle. Namespaces must be exclusive within a channel.",
      "additionalProperties": {
        "$ref": "#/components/schemas/ExtensionManifest"
      }
    }
  },
  "additionalProperties": false
}
```

### ProjectAuthConfig

```json
{
  "type": "object",
  "required": ["issuer", "jwksUrl", "claimMap"],
  "description": "Optional external JWT verification (bring-your-own-JWT).",
  "properties": {
    "issuer": {
      "type": "string"
    },
    "jwksUrl": {
      "type": "string"
    },
    "claimMap": {
      "type": "object",
      "description": "Maps external claims to Portal claims.",
      "additionalProperties": {
        "type": "string"
      }
    }
  },
  "additionalProperties": false
}
```

### ConfigExtract

```json
{
  "type": "object",
  "required": ["version", "project", "channels"],
  "description": "The declarative configuration uploaded by `portal deploy`.",
  "properties": {
    "version": {
      "type": "string",
      "description": "The config format version."
    },
    "project": {
      "type": "object",
      "required": ["webhooks"],
      "properties": {
        "auth": {
          "oneOf": [
            {
              "$ref": "#/components/schemas/ProjectAuthConfig"
            },
            {
              "type": "null"
            }
          ],
          "description": "Optional external auth config. `null` uses Portal-minted JWTs."
        },
        "webhooks": {
          "oneOf": [
            {
              "$ref": "#/components/schemas/WebhookConfig"
            },
            {
              "type": "null"
            }
          ],
          "description": "Webhook delivery configuration set via the `webhooks` field of\n`portal.config.ts`. When set, Portal relays `message.published` and\n`message.retracted` events for every channel to the given endpoint,\nsigned with a per-environment secret (see `GET /v1/webhooks/secret`).\n`null` (the default) disables webhook delivery.\n"
        }
      },
      "additionalProperties": false
    },
    "channels": {
      "type": "object",
      "description": "Channel configs, keyed by channel id (exact id or `*` template; most-specific wins).",
      "additionalProperties": {
        "$ref": "#/components/schemas/ChannelConfig"
      }
    }
  },
  "additionalProperties": false
}
```

### DeployScript

```json
{
  "type": "object",
  "required": ["name", "content"],
  "properties": {
    "name": {
      "type": "string",
      "description": "The bundled script name."
    },
    "content": {
      "type": "string",
      "description": "The bundled script source."
    }
  },
  "additionalProperties": false
}
```

### ExtensionScript

```json
{
  "type": "object",
  "required": ["key", "handle", "name", "content"],
  "properties": {
    "key": {
      "type": "string",
      "description": "The channel key the extension attaches to."
    },
    "handle": {
      "type": "string",
      "description": "The extension handle."
    },
    "name": {
      "type": "string",
      "description": "The bundled script name."
    },
    "content": {
      "type": "string",
      "description": "The bundled script source."
    }
  },
  "additionalProperties": false
}
```

### DeployRequest

```json
{
  "type": "object",
  "required": ["extract"],
  "properties": {
    "extract": {
      "$ref": "#/components/schemas/ConfigExtract"
    },
    "hookScript": {
      "allOf": [
        {
          "$ref": "#/components/schemas/DeployScript"
        }
      ],
      "description": "Optional bundled hooks script, if your config references hooks."
    },
    "extensionScripts": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/ExtensionScript"
      },
      "description": "Optional bundled extension scripts, if your config references extensions."
    }
  },
  "additionalProperties": false
}
```

### DeployResponse

```json
{
  "type": "object",
  "required": ["versionId"],
  "properties": {
    "versionId": {
      "type": "string",
      "description": "The content-addressed version id (`cfg_...`). Stable — identical content always yields the same id."
    }
  },
  "additionalProperties": false
}
```

### DeployRecord

```json
{
  "type": "object",
  "required": ["id", "configVersionId", "action", "createdAt"],
  "properties": {
    "id": {
      "type": "string"
    },
    "configVersionId": {
      "type": "string"
    },
    "action": {
      "type": "string",
      "enum": ["deploy", "rollback"]
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

### ListDeploysResponse

```json
{
  "type": "object",
  "required": ["deploys"],
  "properties": {
    "deploys": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/DeployRecord"
      }
    }
  },
  "additionalProperties": false
}
```

### ActiveConfigResponse

```json
{
  "type": "object",
  "required": ["versionId", "extract", "activatedAt"],
  "properties": {
    "versionId": {
      "type": "string"
    },
    "extract": {
      "$ref": "#/components/schemas/ConfigExtract"
    },
    "activatedAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

### PutSecretRequest

```json
{
  "type": "object",
  "required": ["value"],
  "properties": {
    "value": {
      "type": "string",
      "description": "The secret value. Injected into your config's runtime; never stored in the control plane beyond its name."
    }
  },
  "additionalProperties": false
}
```

### SecretRow

```json
{
  "type": "object",
  "required": ["name", "createdAt", "updatedAt"],
  "properties": {
    "name": {
      "type": "string"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

### ListSecretsResponse

```json
{
  "type": "object",
  "required": ["secrets"],
  "properties": {
    "secrets": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/SecretRow"
      },
      "description": "Secret names and timestamps. Never values."
    }
  },
  "additionalProperties": false
}
```

### WebhookConfig

```json
{
  "type": "object",
  "required": ["url"],
  "description": "Webhook delivery configuration, set via the `webhooks` field of\n`portal.config.ts` (`@portalsdk/config`'s `WebhookConfig` type). One\nendpoint per project.\n",
  "properties": {
    "url": {
      "type": "string",
      "description": "The endpoint Portal POSTs signed webhook events to. Must use\n`https` (or `http`, only for `localhost` / `127.0.0.1` / `[::1]`,\nfor local development) and must not resolve to a private or\ninternal address (RFC1918 ranges, link-local, loopback, an\n`.internal`/`.localhost` TLD, or their IPv6 equivalents) —\n`portal deploy` rejects the config otherwise.\n"
    }
  },
  "additionalProperties": false
}
```

### WebhookDelivery

```json
{
  "type": "object",
  "required": ["id", "channelId", "type", "status", "attempts", "createdAt"],
  "properties": {
    "id": {
      "type": "string",
      "description": "The event id (message id for published, retract_{id} for retracted)."
    },
    "channelId": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": ["message.published", "message.retracted"]
    },
    "status": {
      "type": "string",
      "enum": ["pending", "delivered", "dropped"]
    },
    "attempts": {
      "type": "integer",
      "description": "Number of delivery attempts made so far."
    },
    "lastError": {
      "type": "string",
      "nullable": true,
      "description": "The last error message (null when delivered on first attempt)."
    },
    "createdAt": {
      "type": "integer",
      "description": "Epoch-ms when the event was ingested."
    },
    "deliveredAt": {
      "type": "integer",
      "nullable": true,
      "description": "Epoch-ms when the delivery succeeded (null if pending or dropped)."
    },
    "nextAttemptAt": {
      "type": "integer",
      "nullable": true,
      "description": "Epoch-ms of the next scheduled retry (null if delivered or dropped)."
    }
  },
  "additionalProperties": false
}
```

### ListWebhookDeliveriesResponse

```json
{
  "type": "object",
  "required": ["deliveries"],
  "properties": {
    "deliveries": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/WebhookDelivery"
      }
    }
  },
  "additionalProperties": false
}
```

### WebhookSecretResponse

```json
{
  "type": "object",
  "required": ["secret"],
  "properties": {
    "secret": {
      "type": "string",
      "description": "The per-environment HMAC signing secret (prefix `whsec_`)."
    }
  },
  "additionalProperties": false
}
```
