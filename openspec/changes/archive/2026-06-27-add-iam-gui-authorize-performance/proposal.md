# Change: GUI-gestuetzten Authorize-Performance-Lauf im Monitoring ergaenzen

## Why

Der bestehende Performance-Nachweis fuer `WP-004` ist derzeit nur ueber CLI-/Report-Artefakte erreichbar. Fuer operative Verifikation und Kundenabnahme fehlt ein direkt nutzbarer Einstieg im bestehenden Monitoring-Modul, der mit der aktuellen Session eines berechtigten Administrators echte `authorize`-Laeufe inklusive `recompute` ausfuehren kann.

## What Changes

- Ergaenzung eines neuen IAM-bezogenen Monitoring-Einstiegs unter `/monitoring`
- Platzierung des Bereichs `Authorize Performance` im bestehenden Monitoring-Menue statt im IAM-Cockpit
- Geschuetzter serverseitiger Lauf fuer `cache-hit`, `cache-miss` und `recompute` auf Basis der aktuellen Session
- Ergebnisdarstellung in der GUI mit `Samples`, `p50`, `p95`, `p99`, Bewertung und Report-Verweisen
- Persistierbarer Report-Output fuer die Nachweisfuehrung

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
- Affected code:
  - `apps/sva-studio-react/src/routes/monitoring/`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/auth-runtime`
  - Reporting-/Benchmark-Helfer unter `scripts/ci/` oder servernahen Runtime-Pfaden
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
