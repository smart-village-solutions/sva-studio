# @sva/monitoring-client

OpenTelemetry-Integrations-Paket für SVA Studio. Kapselt den vollständigen OTEL-Stack (Logs, Metriken, Tracing) und stellt Business-Event-Metriken sowie einen PII-redaktierenden Log-Processor bereit.

## Architektur-Rolle

`@sva/monitoring-client` ist das einzige Paket mit direktem Zugriff auf die OpenTelemetry SDKs. Es hat **keine Workspace-Abhängigkeiten** und wird von `@sva/sdk` über eine Bridge konsumiert. Diese Entkopplung ermöglicht:

- Isolierung der OTEL-Komplexität in einem einzigen Paket
- Austauschbarkeit des Monitoring-Backends ohne Auswirkung auf andere Packages
- Unabhängige Versionierung der OTEL-Abhängigkeiten

```
@sva/monitoring-client (keine Workspace-Deps)
  ↑
@sva/sdk ← Bridge via Lazy-Import
  ↑
@sva/auth, App
```

**Abhängigkeiten (extern):**
- `@opentelemetry/sdk-node` – Node.js OTEL SDK
- `@opentelemetry/api` / `@opentelemetry/api-logs` – OTEL APIs
- `@opentelemetry/sdk-logs` / `@opentelemetry/sdk-metrics` – Log/Metric SDKs
- `@opentelemetry/exporter-logs-otlp-http` / `@opentelemetry/exporter-metrics-otlp-http` – OTLP-Exporter
- `@opentelemetry/auto-instrumentations-node` – Auto-Instrumentierung (HTTP)
- `@opentelemetry/resources` / `@opentelemetry/semantic-conventions` – Resource-Modell

## Exports

| Pfad | Beschreibung |
| --- | --- |
| `@sva/monitoring-client` | Business-Event-Metriken, IAM-Latenz-Metriken |
| `@sva/monitoring-client/server` | OTEL SDK Setup, Workspace-Context-Getter |
| `@sva/monitoring-client/logger-provider.server` | Globaler Logger-Provider Singleton |

## Metriken

```ts
import {
  recordBusinessEvent,
  recordIamAuthorizeDecisionLatency,
} from '@sva/monitoring-client';

// Business-Event zählen
recordBusinessEvent('user_login', {
  workspace_id: 'ws-123',
  auth_method: 'oidc',
});

// IAM-Autorisierungs-Latenz messen
recordIamAuthorizeDecisionLatency(12.5, {
  decision: 'allowed',
  reason: 'allowed_by_rbac',
});
```

## OTEL SDK Setup (Server)

```ts
import { createOtelSdk, startOtelSdk } from '@sva/monitoring-client/server';

// SDK erstellen und starten
const sdk = createOtelSdk({
  serviceName: 'sva-studio',
  environment: 'production',
});
await startOtelSdk(sdk);
```

### RedactingLogProcessor

PII-Redaction auf OTEL-Ebene – als letzte Sicherheitsschicht vor dem Export:

- **Forbidden Label Keys:** Sensible Keys werden aus Log-Attributen entfernt
- **E-Mail-Maskierung:** `john@example.com` → `j***@example.com`
- Konfigurierbar via Label-Whitelist

### Workspace-Context-Getter

```ts
import { setWorkspaceContextGetter } from '@sva/monitoring-client/server';

// Wird vom SDK gesetzt, um workspace_id in Logs zu injizieren
setWorkspaceContextGetter(() => ({
  workspaceId: 'ws-123',
  requestId: 'req-456',
}));
```

## Logger-Provider (Server)

Globaler Singleton für den OTEL Logger-Provider – wird vom SDK initialisiert und vom Winston-Transport gelesen.

```ts
import {
  setGlobalLoggerProvider,
  getGlobalLoggerProvider,
  hasLoggerProvider,
} from '@sva/monitoring-client/logger-provider.server';
```

## Konfiguration

| Aspekt | Development | Production |
| --- | --- | --- |
| OTLP-Endpoint | `localhost:4318` | Über OTEL-Env-Vars |
| Batch-Size | Klein (schnelles Flush) | Groß (Performance) |
| Auto-Instrumentation | HTTP | HTTP |
| PII-Redaction | Aktiv | Aktiv |

## Projektstruktur

```
src/
├── index.ts                       # Re-Export Metriken
├── metrics.ts                     # Business Events Counter, IAM Latency Histogram
├── server.ts                      # Server-only Re-Exports
├── otel.server.ts                 # OTEL SDK Setup + RedactingLogProcessor
└── logger-provider.server.ts      # Globaler LoggerProvider Singleton
```

## Nx-Konfiguration

- **Name:** `monitoring-client`
- **Tags:** `scope:monitoring`, `type:lib`
- **Build:** `pnpm nx run monitoring-client:build`
- **Lint:** `pnpm nx run monitoring-client:lint`
- **Tests:** `pnpm nx run monitoring-client:test:unit`
- **Integration:** `pnpm nx run monitoring-client:test:integration` (benötigt laufenden Monitoring-Stack)

## Verwandte Dokumentation

- [Logging-Architektur](../../docs/architecture/logging-architecture.md)
- [Observability Best Practices](../../docs/development/observability-best-practices.md)
- [Monitoring-Stack Setup](../../docs/development/monitoring-stack.md)
- [ADR-004: Monitoring Stack](../../docs/architecture/decisions/ADR-004-monitoring-stack.md)
- [ADR-005: Observability Module Ownership](../../docs/architecture/decisions/ADR-005-observability-module-ownership.md)
- [ADR-006: Logging Pipeline Strategy](../../docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md)
- [ADR-007: Label Schema and PII Policy](../../docs/architecture/decisions/ADR-007-label-schema-and-pii-policy.md)
