# Change: Per-User-Mainserver-GraphQL-Integration

## Why

Die GraphQL-Anbindung an einen SVA-Mainserver ist eine zentrale Schnittstelle
für mehrere Studio-Module. Bisher fehlten dafür eine dedizierte
Integrationsschicht, eine instanzgebundene Endpunktkonfiguration und ein
sicheres Modell, um pro Benutzer hinterlegte Mainserver-Credentials aus
Keycloak serverseitig zu nutzen.

Ohne diese Struktur würden OAuth2-, GraphQL- und Credential-Logik entweder im
Frontend oder verteilt über mehrere Module dupliziert. Das würde die
Paketgrenzen verwässern und das Risiko für Secret-Leaks und inkonsistente
Autorisierungsprüfungen erhöhen.

## What Changes

- Einführung des dedizierten Pakets `packages/sva-mainserver` mit den
  Importpfaden `@sva/sva-mainserver` und `@sva/sva-mainserver/server`
- Erweiterung von `@sva/auth` um serverseitiges Lesen von Keycloak-User-
  Attributen für per-User-Mainserver-Credentials
- Erweiterung von `@sva/data` um `iam.instance_integrations` und ein Repository
  für instanzgebundene Mainserver-Endpunktkonfiguration (inkl. TTL-Cache)
- Serverseitige OAuth2-/GraphQL-Delegation mit deterministischem Error-Mapping,
  LRU-begrenzten In-Memory-Caches, HTTP-Timeouts und Korrelation über
  `request_id`/`trace_id`
- Vollständige Logging-Instrumentierung aller Fehler- und Erfolgspfade
  (SDK Logger mit `workspace_id` als Pflichtfeld)
- Erste Anbindung an `apps/sva-studio-react` über eine TanStack-Start-
  Server-Funktion statt direkten Browser-Zugriffs (inkl. Audit-Trail bei
  Zugriffsverweigerung)
- Fortschreibung von OpenSpec, ADR-021 (Per-User-SVA-Mainserver-Delegation)
  und arc42-Dokumentation
- Dockerfile um Build-Step für `sva-mainserver` erweitern
- Coverage-Baseline für `@sva/sva-mainserver` in `coverage-policy.json`
  definieren
- Betriebsrunbook unter `docs/development/runbook-sva-mainserver.md` erstellen

## Impact

- **Affected specs:**
  - `iam-core`
  - `monorepo-structure`
- **Affected code:**
  - `packages/auth/src/*`
  - `packages/data/src/integrations/*`
  - `packages/data/migrations/*0013*`
  - `packages/sva-mainserver/*`
  - `apps/sva-studio-react/src/lib/sva-mainserver.server.ts`
  - `apps/sva-studio-react/vitest.config.ts`
  - `tsconfig.base.json`
  - `eslint.config.mjs`
  - `deploy/portainer/Dockerfile`
  - `tooling/testing/coverage-policy.json`
- **Affected arc42 sections:**
  - `03-context-and-scope`
  - `04-solution-strategy`
  - `05-building-block-view` (inkl. Schichtdefinition `scope:integration`)
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `09-architecture-decisions` (ADR-021)
  - `11-risks-and-technical-debt` (Cache-Skalierung, Schema-Drift)
- **Datenklassifizierung:** Die über den Mainserver abgerufenen Fachdaten
  (News, Events, POI etc.) sind öffentlich. Keine personenbezogenen Daten
  im Sinne der DSGVO betroffen.
