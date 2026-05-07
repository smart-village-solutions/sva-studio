# Change: Cross-Cutting Runtime- und Plugin-Guardrails refaktorieren

## Why

Die aktuelle Architektur hat mehrere runtime-emergente und paketübergreifende Risiken, die durch lokale Unit-Tests nicht sichtbar werden. Besonders betroffen sind der Auth-Session-Pfad, der Plugin-Vertrag und die CI-Erzwingung zentraler Architekturregeln.

## What Changes

- Der Auth-Session-Pfad wird für parallele Requests, minimale `/auth/me`-Payloads und adapterübergreifende Session-Store-Parität normativ gehärtet.
- Der Plugin-Vertrag wird an den Host gebunden: fail-fast bei Routen- und Translation-Kollisionen, SDK-Kompatibilitätsprüfung, typisierte Routenbeiträge, runtime-fähige Aktivierung und zentrale IAM-Cross-Validation.
- Die Plattform führt harte Architektur-Gates für Dependency-Graph, i18n, server-only Importe, Interfaces-Leaks, Migrationsdrift und OTEL-Bootstrapping ein.
- Kritische Auth-, Registry- und Routing-Hotspots erhalten strengere Coverage- und Komplexitäts-Governance inklusive Ratcheting- und No-Growth-Regeln.
- Host und Plugins erhalten einen gemeinsamen Invalidation-Tag-Vertrag, damit Mutationen cache-konsistent über Paketgrenzen hinweg bleiben.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `routing`, `monorepo-structure`, `monitoring-client`, `content-management`, `deployment-topology`, `test-coverage-governance`, `complexity-quality-governance`, `architecture-documentation`
- Affected code: `apps/sva-studio-react`, `packages/auth-runtime`, `packages/plugin-sdk`, `packages/routing`, `packages/data`, `packages/core`, `tooling/testing`, `tooling/quality`, `scripts/`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`
