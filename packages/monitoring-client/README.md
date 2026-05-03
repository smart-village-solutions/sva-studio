# @sva/monitoring-client

OpenTelemetry-Paket für SVA Studio mit clientseitigen Metriken, browserseitigem Logging und serverseitiger OTEL-Initialisierung inklusive PII-Redaktion.

## Architektur-Rolle

`@sva/monitoring-client` bündelt die Monitoring-spezifische Infrastruktur für Logs und Metriken in einem eigenständigen Library-Paket. Das Paket trennt browsernahe Logging-Hilfen, wiederverwendbare Redaktionslogik und serverseitige OpenTelemetry-Initialisierung, damit Fachlogik keine direkten SDK-Details kennen muss.

Die öffentliche Oberfläche ist entlang der Laufzeitkontexte getrennt:

- `@sva/monitoring-client` für Metriken
- `@sva/monitoring-client/logging` für Browser-Logging und Redaktionshelfer
- `@sva/monitoring-client/server` für OTEL-Setup und Workspace-Kontext im Node-Kontext
- `@sva/monitoring-client/logger-provider.server` für den globalen Logger-Provider-Singleton

## Öffentliche API

Die Root-API exportiert Metrikfunktionen für fachliche Ereignisse und Latenzen:

- `recordBusinessEvent(eventName, attributes)` zählt Business-Events über den OTEL-Meter `sva.monitoring`
- `recordIamAuthorizeDecisionLatency(durationMs, attributes)` misst clientseitige Autorisierungs-Latenzen in Millisekunden

Die Logging-API unter `@sva/monitoring-client/logging` stellt bereit:

- `createBrowserLogger(...)` für browserseitiges Logging mit konfigurierbarem Log-Level
- `registerBrowserLogSink(...)` zum Mitschneiden strukturierter Browser-Logs
- `isBrowserConsoleCaptureSuppressed()` zur Vermeidung rekursiver Sink-Fehler
- `redactLogString(...)`, `redactLogMeta(...)`, `serializeAndRedactLogValue(...)` und `stringifyNonPlainValue(...)` für PII-sichere Log-Aufbereitung

Die Server-API unter `@sva/monitoring-client/server` ergänzt:

- `createOtelSdk(config)` zum Erzeugen eines `NodeSDK` mit OTLP-Log- und Metrikexport
- `startOtelSdk(config)` zum Starten des SDKs und Registrieren des globalen Logger-Providers
- `setWorkspaceContextGetter(getter)` zum Injizieren von `workspace_id` in Log-Records
- Typen `OtelConfig` und `WorkspaceContext`

Das Modul `@sva/monitoring-client/logger-provider.server` exportiert:

- `setGlobalLoggerProvider(provider)`
- `getGlobalLoggerProvider()`
- `hasLoggerProvider()`

## Nutzung und Integration

Für fachliche Metriken wird die Root-API direkt verwendet:

```ts
import {
  recordBusinessEvent,
  recordIamAuthorizeDecisionLatency,
} from '@sva/monitoring-client';

recordBusinessEvent('user_login', {
  workspace_id: 'ws-123',
  auth_method: 'oidc',
});

recordIamAuthorizeDecisionLatency(12.5, {
  decision: 'allowed',
});
```

Browser-Code nutzt den dedizierten Logging-Exportpfad:

```ts
import { createBrowserLogger } from '@sva/monitoring-client/logging';

const logger = createBrowserLogger({
  component: 'auth-login-form',
  level: 'info',
});

logger.info('Login gestartet', { workspaceId: 'ws-123' });
```

Server-Code initialisiert das OTEL-SDK ausschließlich über den Server-Exportpfad:

```ts
import { startOtelSdk, setWorkspaceContextGetter } from '@sva/monitoring-client/server';

setWorkspaceContextGetter(() => ({
  workspaceId: 'ws-123',
}));

await startOtelSdk({
  serviceName: 'sva-studio',
  environment: 'production',
});
```

Die integrierte Redaktionslogik maskiert E-Mail-Adressen, JWT-ähnliche Tokens sowie sensible Schlüssel wie `authorization`, `access_token`, `session_id` oder `email`, bevor Logs in Konsole, Sinks oder OTEL-Exporter gelangen.

## Projektstruktur

```text
packages/monitoring-client/
├── src/
│   ├── index.ts
│   ├── metrics.ts
│   ├── logging.ts
│   ├── logging/
│   │   ├── browser.ts
│   │   └── redaction.ts
│   ├── otel.server.ts
│   ├── server.ts
│   └── logger-provider.server.ts
├── tests/
├── scripts/
├── package.json
├── project.json
└── vitest.config.ts
```

## Nx-Konfiguration

- Projektname: `monitoring-client`
- Projekttyp: `library`
- Source-Root: `packages/monitoring-client/src`
- Tags: `scope:monitoring`, `type:lib`
- Build: `pnpm nx run monitoring-client:build`
- Lint: `pnpm nx run monitoring-client:lint`
- Unit-Tests: `pnpm nx run monitoring-client:test:unit`
- Coverage: `pnpm nx run monitoring-client:test:coverage`
- Runtime-Check: `pnpm nx run monitoring-client:check:runtime`
- Integrationstest gegen den Monitoring-Stack: `pnpm nx run monitoring-client:test:integration`

## Verwandte Dokumentation

- [Logging-Architektur](../../docs/architecture/logging-architecture.md)
- [Observability Best Practices](../../docs/development/observability-best-practices.md)
- [Monitoring-Stack Setup](../../docs/development/monitoring-stack.md)
- [ADR-004: Monitoring Stack](../../docs/architecture/decisions/ADR-004-monitoring-stack.md)
- [ADR-005: Observability Module Ownership](../../docs/architecture/decisions/ADR-005-observability-module-ownership.md)
- [ADR-006: Logging Pipeline Strategy](../../docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md)
- [ADR-007: Label Schema and PII Policy](../../docs/architecture/decisions/ADR-007-label-schema-and-pii-policy.md)
