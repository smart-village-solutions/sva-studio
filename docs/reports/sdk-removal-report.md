# Abschlussbericht: Entfernung von `@sva/sdk`

## Ergebnis

Zum Stand 2026-05-02 ist `@sva/sdk` aus dem aktiven Workspace entfernt. Die kanonischen Ersatzpfade sind:

- `@sva/plugin-sdk` fuer Plugin-, Registry-, Admin-Resource- und Content-Type-Vertraege
- `@sva/server-runtime` fuer Logging, Request-Kontext, JSON-Fehlerantworten, Instanzkonfiguration und OTEL-Bootstrap
- `@sva/core` fuer `runtime-profile`
- `@sva/monitoring-client/logging` fuer browsernahes Logging

## Entfernte Bestandteile

- Workspace-Paket `packages/sdk/`
- Nx-Targets `sdk:*`
- Builder-Workspace-Eintrag fuer `packages/sdk`
- Coverage-Policy- und Baseline-Eintraege fuer `sdk`
- aktive Entwickler- und Architekturhinweise, die `@sva/sdk` noch als verfuegbaren Vertrag beschrieben haben

## Test- und Tooling-Verlagerung

- pluginbezogene SDK-Tests liegen jetzt unter `packages/plugin-sdk/tests/`
- server-runtime-bezogene SDK-Tests liegen jetzt unter `packages/server-runtime/tests/`
- CI-, Coverage- und Ops-nahe Skriptpruefungen liegen jetzt unter `tooling/testing/tests/`

## Repo-Status

Gepruefte aktive Bereiche:

- `packages/`
- `apps/`
- `scripts/`
- `tooling/testing/`
- aktive `docs/`- und `.github/`-Quellen ausserhalb von `docs/staging/` und `docs/pr/`

Befund:

- keine aktiven produktiven `@sva/sdk`-Consumer mehr
- keine aktiven Workspace-Metadaten fuer `packages/sdk` oder `sdk:*`
- historische dated reports und archivierte Aenderungen koennen weiter Altverweise enthalten, liegen aber ausserhalb des Scopes dieses Breaking-Cuts

## Migrationsmapping

| Alter Pfad | Neuer Pfad |
| --- | --- |
| `@sva/sdk` | `@sva/plugin-sdk` |
| `@sva/sdk/server` | `@sva/server-runtime` |
| `@sva/sdk/logger/*` | `@sva/server-runtime/logger/*` |
| `@sva/sdk/middleware/*` | `@sva/server-runtime/middleware/*` |
| `@sva/sdk/observability/*` | `@sva/server-runtime/observability/*` |
| `@sva/sdk/runtime-profile` | `@sva/core` |
| `@sva/sdk/logging` | `@sva/monitoring-client/logging` |
