# @sva/sdk

Server-SDK für SVA Studio. Stellt den strukturierten Logger, Request-Context-Middleware, Workspace-Context-Propagation und OTEL-Bootstrapping bereit.

## Architektur-Rolle

`@sva/sdk` ist die zentrale Infrastrukturschicht für serverseitigen Code. Alle Server-Module nutzen den SDK Logger statt `console.*`. Der SDK sorgt für:

- **Strukturiertes Logging** mit automatischer PII-Redaction
- **Context-Propagation** über AsyncLocalStorage (workspace_id, request_id, trace_id)
- **OTEL-Integration** mit direktem Transport zu OpenTelemetry

```
@sva/core              ← Core-Version
  ↑
@sva/monitoring-client ← OTEL Bridge
  ↑
@sva/sdk
  ↑
@sva/auth              ← nutzt SDK Logger + Context
```

**Abhängigkeiten:**
- `@sva/core` (workspace) – Core-Version
- `@sva/monitoring-client` (workspace) – OTEL Logger-Provider Bridge
- `winston` / `winston-transport` – Logging-Backend
- `@opentelemetry/api` / `@opentelemetry/sdk-node` – Observability

## Exports

| Pfad | Beschreibung |
| --- | --- |
| `@sva/sdk` | SDK-Version (`sdkVersion`) |
| `@sva/sdk/server` | Logger, Middleware, Context, OTEL Bootstrap |
| `@sva/sdk/logger/index.server` | Winston Logger direkt |
| `@sva/sdk/middleware/request-context.server` | Request-Context Middleware |
| `@sva/sdk/observability/context.server` | AsyncLocalStorage Workspace-Context |

## SDK Logger

```ts
import { createSdkLogger } from '@sva/sdk/server';

const logger = createSdkLogger({
  component: 'mein-modul',    // Pflicht – eindeutiger Modulname
  level: 'info',               // Optional (Default: 'info')
  enableConsole: true,         // Optional (Default: true in non-production)
  enableOtel: true,            // Optional (Default: true)
});

logger.info('Operation erfolgreich', {
  operation: 'create_entity',
  entity_id: '123',
});

logger.error('Verbindung fehlgeschlagen', {
  operation: 'db_connect',
  error: err.message,
  error_type: err.constructor.name,
});
```

### PII-Redaction (automatisch)

Der Logger maskiert automatisch sensible Daten:

- **Redaktierte Keys:** `password`, `token`, `authorization`, `api_key`, `secret`, `email`
- **E-Mail-Masking:** `john@example.com` → `j***@example.com`
- **Kontexterweiterung:** `workspace_id`, `request_id`, `trace_id`, `user_id`, `session_id` werden automatisch aus dem AsyncLocalStorage-Context angehängt

### OTEL-Transport

Der Logger sendet Logs direkt an den OTEL Logger-Provider über einen eigenen `DirectOtelTransport`. Severity-Level werden automatisch von Winston auf OTEL gemappt.

## Request-Context Middleware

```ts
import { withRequestContext } from '@sva/sdk/server';

await withRequestContext({ request }, async () => {
  // workspace_id, request_id, trace_id sind automatisch verfügbar
  logger.info('Request verarbeitet');
});
```

**Extrahierte Header:**
- `x-workspace-id` / `x-sva-workspace-id` → `workspace_id`
- `x-request-id` / `x-correlation-id` → `request_id`
- W3C `traceparent` → `trace_id`

**Sicherheit:** Alle Header werden sanitiert (Längenlimit, Pattern-Matching gegen Injection).

## Workspace-Context

AsyncLocalStorage-basierter Context für Request-übergreifende Daten.

```ts
import {
  runWithWorkspaceContext,
  getWorkspaceContext,
  createWorkspaceContextMiddleware,
} from '@sva/sdk/server';

// Manuell
await runWithWorkspaceContext({ workspaceId: 'ws-123' }, async () => {
  const ctx = getWorkspaceContext();
  // ctx.workspaceId === 'ws-123'
});

// Express-Middleware
app.use(createWorkspaceContextMiddleware());
```

**Context-Felder:** `workspaceId`, `requestId`, `traceId`, `userId`, `sessionId`

## OTEL Bootstrap

```ts
import { initializeOtelSdk } from '@sva/sdk/server';

// Idempotent – kann mehrfach aufgerufen werden
await initializeOtelSdk();
```

**Verhalten:**
- **Development:** OTEL ist per Default aus, aktivierbar via `ENABLE_OTEL=true`
- **Production:** OTEL ist immer aktiv
- **Graceful Shutdown:** SIGTERM/SIGINT löst sauberes SDK-Shutdown aus

## Projektstruktur

```
src/
├── index.ts                                  # SDK-Version
├── server.ts                                 # Server Haupt-Export
├── logger/
│   └── index.server.ts                       # Winston Logger + OTEL Transport
├── middleware/
│   └── request-context.server.ts             # Request-Context Extraktion
├── observability/
│   ├── context.server.ts                     # AsyncLocalStorage Workspace-Context
│   └── monitoring-client.bridge.server.ts    # Bridge zu @sva/monitoring-client
└── server/
    └── bootstrap.server.ts                   # OTEL SDK Bootstrap (139 Zeilen)
```

## Nx-Konfiguration

- **Name:** `sdk`
- **Tags:** `scope:sdk`, `type:lib`
- **Build:** `pnpm nx run sdk:build`
- **Lint:** `pnpm nx run sdk:lint`
- **Tests:** `pnpm nx run sdk:test:unit`
- **Coverage:** `pnpm nx run sdk:test:coverage`

## Verwandte Dokumentation

- [Observability Best Practices](../../docs/development/observability-best-practices.md)
- [Logging-Architektur](../../docs/architecture/logging-architecture.md)
- [ADR-006: Logging Pipeline Strategy](../../docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md)
- [ADR-007: Label Schema and PII Policy](../../docs/architecture/decisions/ADR-007-label-schema-and-pii-policy.md)
- [ADR-005: Observability Module Ownership](../../docs/architecture/decisions/ADR-005-observability-module-ownership.md)
- [Querschnittliche Konzepte (arc42 §8)](../../docs/architecture/08-cross-cutting-concepts.md)