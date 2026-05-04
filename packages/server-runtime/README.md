# @sva/server-runtime

`@sva/server-runtime` bündelt serverseitige Laufzeitbausteine für Logging, Observability, Request-Kontext und standardisierte Fehlerantworten innerhalb des SVA-Workspaces.

## Architektur-Rolle

Das Paket stellt die gemeinsame Server-Runtime für Node-basierte SVA-Dienste bereit. Es kapselt wiederverwendbare Infrastruktur, die nicht in Fachlogik oder UI-Pakete gehört:

- Request- und Workspace-Kontext über `AsyncLocalStorage`
- strukturierte Server-Logs mit Redaction, Development-Puffer und OpenTelemetry-Anbindung
- Bootstrap-Helfer für die Initialisierung der Observability-Laufzeit
- standardisierte JSON-Fehlerantworten für serverseitige Handler
- Multi-Host-Instanzkonfiguration für Host-basierte Deployments

Die Kernidee ist, servernahe Querschnittsfunktionen zentral zu halten, damit andere Pakete nicht jeweils eigene Logging-, Context- oder OTEL-Initialisierung implementieren müssen.

## Öffentliche API

Der Einstiegspunkt ist `src/index.ts`. Er exportiert eine kleine, auf Server-Laufzeit ausgerichtete API:

- Logging:
  `createSdkLogger`, `redactObject`, `getLoggingRuntimeConfig`, `getOtelInitializationResult`, `readDevelopmentLogEntries`
- Request-Kontext:
  `withRequestContext`, `getHeadersFromRequest`, `extractWorkspaceIdFromHeaders`, `extractRequestIdFromHeaders`, `extractTraceIdFromHeaders`
- Observability-Kontext:
  `createWorkspaceContextMiddleware`, `runWithWorkspaceContext`, `getWorkspaceContext`, `setWorkspaceContext`, `extractWorkspaceId`, `MissingWorkspaceIdError`
- Server-Bootstrap und Fehlerantworten:
  `initializeOtelSdk`, `toJsonErrorResponse`
- Instanzkonfiguration:
  `getInstanceConfig`, `parseInstanceIdFromHost`, `isCanonicalAuthHost`, `resetInstanceConfigCache`

Zusätzlich veröffentlicht das Paket gezielte Subpath-Exports für servernahe Integrationen:

- `@sva/server-runtime/logger/index.server`
- `@sva/server-runtime/logger/logging-runtime.server`
- `@sva/server-runtime/logger/dev-log-buffer.server`
- `@sva/server-runtime/middleware/request-context.server`
- `@sva/server-runtime/observability/context.server`

## Nutzung und Integration

Typische Integration:

1. Beim Server-Start `initializeOtelSdk()` ausführen, damit die OTEL-Laufzeit und der Monitoring-Bridge-Code initialisiert werden.
2. Pro Request `withRequestContext(...)` oder `createWorkspaceContextMiddleware(...)` verwenden, damit `workspaceId`, `requestId` und optional `traceId` in den Async-Kontext gelangen.
3. Innerhalb von Server-Code Logger über `createSdkLogger({ component: '...' })` erzeugen, damit Logs automatisch Kontextinformationen und Redaction erhalten.
4. Für konsistente API-Fehler `toJsonErrorResponse(...)` nutzen.

Laufzeitverhalten wird vor allem über Umgebungsvariablen beeinflusst:

- `NODE_ENV` steuert Development-/Production-Verhalten
- `ENABLE_OTEL` aktiviert oder deaktiviert OTEL
- `SVA_ENABLE_SERVER_CONSOLE_LOGS` erlaubt Console-Logs in Production explizit
- `OTEL_SERVICE_NAME` und `OTEL_EXPORTER_OTLP_ENDPOINT` konfigurieren die OTEL-Initialisierung
- `SVA_PARENT_DOMAIN` und `SVA_ALLOWED_INSTANCE_IDS` steuern die Multi-Host-Instanzkonfiguration

Das Paket hängt zur Laufzeit direkt von `@sva/core` und `@sva/monitoring-client` ab. Die Monitoring-Integration wird über eine Bridge mit dynamischen Imports entkoppelt.

## Projektstruktur

```text
packages/server-runtime/
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── instance/
    │   └── config.server.ts
    ├── logger/
    │   ├── dev-log-buffer.server.ts
    │   ├── index.server.ts
    │   ├── logging-runtime.server.ts
    │   └── otel-logger.types.ts
    ├── logging/
    │   └── redaction.ts
    ├── middleware/
    │   └── request-context.server.ts
    ├── observability/
    │   ├── context.server.ts
    │   └── monitoring-client.bridge.server.ts
    └── server/
        ├── bootstrap.server.ts
        └── json-error-response.server.ts
```

Die Tests liegen überwiegend direkt neben den Implementierungen als `src/**/*.test.ts`. Ergänzend nutzt das Paket bei Bedarf auch eigenständige Tests unter `tests/**/*.test.ts`, wenn eine stärkere Trennung von Implementierung und Test-Setup sinnvoll ist.

## Nx-Konfiguration

Das Paket ist in Nx als Library `server-runtime` registriert (`packages/server-runtime/project.json`).

Verfügbare Targets:

- `build`: kompiliert das Paket mit `tsc -p packages/server-runtime/tsconfig.lib.json` nach `dist/`
- `check:runtime`: prüft die Server-Package-Runtime-Regeln über `scripts/ci/check-server-package-runtime.ts`
- `lint`: führt ESLint für `packages/server-runtime/src/**/*.{ts,tsx,js,jsx}` aus
- `test:unit`: startet die Vitest-Unit-Tests innerhalb des Pakets
- `test:types`: prüft die TypeScript-Typen mit `tsc --noEmit`
- `test:coverage`: führt die Unit-Tests mit Coverage aus

Die Bibliothek ist als `type: "module"` konfiguriert und folgt den ESM-Regeln des Workspaces. Runtime-Exports zeigen auf die gebauten Dateien unter `dist/`.

## Verwandte Dokumentation

- [AGENTS.md](../../AGENTS.md) für Repository-Regeln, Testvorgaben und Dokumentationskonventionen
- [DEVELOPMENT_RULES.md](../../DEVELOPMENT_RULES.md) für verbindliche Entwicklungsrichtlinien
- `packages/server-runtime/project.json` für die aktuellen Nx-Targets
- `packages/server-runtime/package.json` für veröffentlichte Exports und Laufzeitabhängigkeiten
