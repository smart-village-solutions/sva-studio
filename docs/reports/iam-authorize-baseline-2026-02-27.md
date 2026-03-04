# IAM Authorize Baseline 2026-02-27

## Kontext

Messung für Child C Task `2.3` (`add-iam-authorization-rbac-v1`): P95-Baseline für den aktuellen RBAC-v1-Authorize-Pfad.

## Setup

- Messdatum: 27.02.2026
- Komponente: `evaluateAuthorizeDecision` aus `packages/auth/src/iam-authorization.server.ts`
- Ausführung: `cd packages/auth && pnpm exec tsx bench/authorize-latency-benchmark.ts`
- Szenario:
  - 512 effektive Permissions im Evaluationssatz
  - 2.000 Warmup-Iterationen
  - 20.000 Mess-Iterationen
  - Request mit gültigem `instanceId`- und `organizationId`-Kontext

## Messergebnis

- `avg`: `0.0005 ms`
- `p50`: `0.0005 ms`
- `p95`: `0.0007 ms`
- `p99`: `0.0012 ms`
- `max`: `0.0368 ms`
- Zielwert: `p95 < 50 ms`
- Ergebnis: erfüllt (`withinTarget=true`)

## Einordnung

Die gemessene Baseline liegt deutlich unter dem Zielwert. Diese Messung bildet die reine RBAC-v1-Evaluator-Logik ab und dient als Referenzwert für spätere Vergleiche.

Für nachfolgende Schritte (ABAC, Hierarchie, Cache) wird empfohlen, zusätzlich Endpunkt-nahe Messungen inkl. DB-/I/O-Anteilen zu erfassen.

## OTEL-Metrikexport (kontinuierlich)

- Laufzeitmetrik: `sva_iam_authorize_duration_ms` (Histogramm)
- Instrumentierung: `packages/auth/src/iam-authorization.server.ts` (`meter = sva.auth`)
- Attribute:
  - `endpoint`: `/iam/authorize`
  - `allowed`: `true|false`
  - `reason`: Reason-/Error-Code der Entscheidung
- Zielnutzung:
  - P95/P99 aus OTEL-Metrics im regulären Betrieb ableiten
  - Baseline und Drift nicht nur als einmaligen Benchmark, sondern kontinuierlich beobachten
