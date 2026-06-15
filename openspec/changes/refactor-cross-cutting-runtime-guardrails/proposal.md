# Change: Cross-Cutting Runtime- und Plugin-Guardrails refaktorieren

## Why

Die aktuelle Architektur hat mehrere runtime-emergente und paketübergreifende Risiken, die durch lokale Unit-Tests nicht sichtbar werden. Besonders betroffen sind der Auth-Session-Pfad, der Plugin-Vertrag und die CI-Erzwingung zentraler Architekturregeln.

## What Changes

- Als erster Delivery-Slice wird eine report-only Sichtbarkeitsphase eingeführt: neue Guardrail-Signale erscheinen in `env:doctor:studio`, `env:precheck:studio` und `pnpm check:guardrails:report`, ohne bestehende PR-, Build- oder Deploy-Gates zu verschärfen.
- Der Auth-Session-Pfad wird für parallele Requests, minimale `/auth/me`-Payloads und adapterübergreifende Session-Store-Parität normativ gehärtet.
- Der Plugin-Vertrag wird an den Host gebunden: fail-fast bei Routen- und Translation-Kollisionen, SDK-Kompatibilitätsprüfung, typisierte Routenbeiträge, runtime-fähige Aktivierung und zentrale IAM-Cross-Validation.
- Die Plattform führt harte Architektur-Gates für Dependency-Graph, i18n, server-only Importe, Interfaces-Leaks, Migrationsdrift und OTEL-Bootstrapping ein.
- Kritische Auth-, Registry- und Routing-Hotspots erhalten strengere Coverage- und Komplexitäts-Governance inklusive Ratcheting- und No-Growth-Regeln.
- Host und Plugins erhalten einen gemeinsamen Invalidation-Tag-Vertrag, damit Mutationen cache-konsistent über Paketgrenzen hinweg bleiben.

## Current Findings

- Der report-only Plugin-Contract-Check macht aktuell sichtbar, dass die Workspace-Plugins `news`, `events`, `poi` und `waste-management` zwar eine `sdkVersion`, aber noch keine explizite SDK-Kompatibilitäts-Range im sichtbaren Vertrag dokumentieren.
- Der report-only Architektur-Check meldet derzeit viele server-only Importpfade; ein Teil davon ist bewusst serverseitige Verdrahtung, ein anderer Teil ist Architekturdrift oder potenzieller Bundling-/Boundary-Risikobereich und muss noch triagiert werden.
- Der report-only Runtime-Boot-Check sieht aktuell keinen akuten Befund: OTEL-/Logger-Modus und die zuletzt bekannte Migration sind sichtbar, werden aber noch nicht fail-closed erzwungen.
- Der report-only Auth-Session-Check zeigt vorhandene Characterization-Pfade, aber die eigentliche Serialisierung von Refresh-Konkurrenz und die Adapter-Paritätsprüfung bleiben offen.
- Der report-only Cache-Contract-Check hat exemplarisch Mutations-/Refresh-Pfade ohne zentral sichtbaren Invalidierungsvertrag identifiziert, aktuell unter anderem `apps/sva-studio-react/src/hooks/use-plugin-operation-jobs.ts` und `apps/sva-studio-react/src/hooks/use-runtime-health.ts`.

## Impact

- Affected specs: `iam-core`, `iam-access-control`, `routing`, `monorepo-structure`, `monitoring-client`, `content-management`, `deployment-topology`, `test-coverage-governance`, `complexity-quality-governance`, `architecture-documentation`
- Affected code: `apps/sva-studio-react`, `packages/auth-runtime`, `packages/plugin-sdk`, `packages/routing`, `packages/data`, `packages/core`, `tooling/testing`, `tooling/quality`, `scripts/`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`
