# Performance-Nachweise: Refactor Auth-Routing & Logging – 2026-03-10

## Kontext

Dieser Bericht schließt die letzten offenen Performance-Aufgaben des Changes `refactor-auth-routing-and-logging`:

- Mikrobenchmark für Error-Boundary- und Startup-Guard-Overhead im Routing
- Benchmark für große IAM-Keycloak-Sync-Batches mit Debug aus/an

Die Messungen sind bewusst fokussiert und komponentennah. Sie isolieren den durch den Change eingeführten Overhead und ersetzen keinen End-to-End-Lasttest mit Netzwerk, Datenbank und Browser.

## Setup

- Messdatum: 10.03.2026
- Laufzeit: lokaler Entwickler-Workflow auf dem Workspace-Stand nach Abschluss von `pnpm test:ci`
- Ausführung Routing:

```bash
pnpm exec tsx packages/routing/bench/auth-routing-overhead-benchmark.ts
```

- Ausführung Sync-Batch:

```bash
pnpm exec tsx packages/auth/bench/user-import-sync-batch-benchmark.ts
```

## Messergebnis Routing

- Szenario: `auth-routing-error-boundary-and-startup-guard-overhead`
- Startup-Guard (`verifyAuthRouteHandlerCoverage`)
  - `20.000` Mess-Iterationen, `2.000` Warmup-Iterationen
  - Zielwert: `p95 < 1 ms`
- Success-Path Error-Boundary (`wrapHandlersWithJsonErrorBoundary`)
  - `20.000` Mess-Iterationen, `2.000` Warmup-Iterationen
  - Zielwert: `wrapped p95 < 1 ms`

Ergebnis:

- Startup-Guard:
  - `avg`: `0.0013 ms`
  - `p95`: `0.0016 ms`
  - `max`: `0.3883 ms`
  - Ziel erfüllt
- Success-Path Error-Boundary:
  - Raw-Handler `avg`: `0.0003 ms`
  - Wrapped-Handler `avg`: `0.0002 ms`
  - Overhead `avg`: `-0.0001 ms`
  - Wrapped-Handler `p95`: `0.0003 ms`
  - Ziel erfüllt

## Messergebnis Sync-Batch

- Szenario: `iam-user-import-sync-batch-skip-logging`
- Datenmenge:
  - `10.000` Keycloak-User pro Lauf
  - `2.000` passend zur Zielinstanz
  - `8.000` übersprungen
  - `8` verschiedene fremde `instanceId`-Werte
  - Debug-Detail-Logs bleiben auf `20` Einträge gecappt
- Messung:
  - `300` Mess-Iterationen, `50` Warmup-Iterationen je Szenario
  - Zielwert: `p95 < 25 ms`

Ergebnis:

- Debug aus:
  - `avg`: `0.2562 ms`
  - `p95`: `0.2952 ms`
  - Ziel erfüllt
- Debug an:
  - `avg`: `0.2129 ms`
  - `p95`: `0.2555 ms`
  - Ziel erfüllt
- Overhead Debug an vs. aus:
  - `avg`: `-0.0433 ms`
  - `p95`: `-0.0397 ms`

## Einordnung

- Der Startup-Guard ist praktisch vernachlässigbar und bleibt deutlich unterhalb von `1 ms`.
- Die Routing-Error-Boundary erhöht den Success-Path in dieser Messung nicht messbar; die Differenz liegt im Bereich normaler Mikrobenchmark-Schwankung.
- Der gecappte Debug-Pfad im Keycloak-Sync bleibt auch bei `10.000` Eingangsnutzern weit unter dem gewählten `25 ms`-Zielwert; die negative Differenz zwischen Debug aus/an ist als Messrauschen zu interpretieren, nicht als belastbarer Speedup.

## Einschränkungen

- Die Sync-Messung fokussiert den geänderten Filter-/Logging-Pfad und misst nicht den Datenbank-Upsert oder externe Keycloak-I/O.
- Die Routing-Messung betrachtet den Hot Path auf Funktionsniveau; reale HTTP-Latenzen bleiben höher durch Framework-, Netzwerk- und Serialisierungskosten.
