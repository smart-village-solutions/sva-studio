# Change: Cross-Cutting Runtime- und Plugin-Guardrails refaktorieren

## Why

Die aktuelle Architektur hat mehrere runtime-emergente und paketuebergreifende Risiken, die durch lokale Unit-Tests nicht sichtbar werden. Besonders betroffen sind der Auth-Session-Pfad, der Plugin-Vertrag und die CI-Erzwingung zentraler Architekturregeln.

## What Changes

- Der Auth-Session-Pfad wird fuer parallele Requests, minimale `/auth/me`-Payloads und adapteruebergreifende Session-Store-Paritaet normativ gehaertet.
- Der Plugin-Vertrag wird an den Host gebunden: fail-fast bei Routen- und Translation-Kollisionen, SDK-Kompatibilitaetspruefung, typisierte Routenbeitraege, runtime-faehige Aktivierung und zentrale IAM-Cross-Validation.
- Die Plattform fuehrt harte Architektur-Gates fuer Dependency-Graph, i18n, server-only Importe, Interfaces-Leaks, Migrationsdrift und OTEL-Bootstrapping ein.
- Kritische Auth-, Registry- und Routing-Hotspots erhalten strengere Coverage- und Komplexitaets-Governance inklusive Ratcheting- und No-Growth-Regeln.
- Host und Plugins erhalten einen gemeinsamen Invalidation-Tag-Vertrag, damit Mutationen cache-konsistent ueber Paketgrenzen hinweg bleiben.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `routing`, `monorepo-structure`, `monitoring-client`, `content-management`, `deployment-topology`, `test-coverage-governance`, `complexity-quality-governance`, `architecture-documentation`
- Affected code: `apps/sva-studio-react`, `packages/auth-runtime`, `packages/plugin-sdk`, `packages/routing`, `packages/data`, `packages/core`, `tooling/testing`, `tooling/quality`, `scripts/`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`
