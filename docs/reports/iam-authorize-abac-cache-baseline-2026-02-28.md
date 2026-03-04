# IAM Authorize Baseline (Child D) – 2026-02-28

## Kontext

Messung für Child D (`add-iam-abac-hierarchy-cache`): P95-Messung des aktualisierten Evaluators (`RBAC + ABAC + Hierarchie`), als Ergänzung zur Child-C-Baseline.

## Setup

- Messdatum: 28.02.2026
- Komponente: `evaluateAuthorizeDecision`
- Ausführung: `cd packages/auth && pnpm exec tsx bench/authorize-latency-benchmark.ts`
- Szenario:
  - 512 effektive Permissions
  - 2.000 Warmup-Iterationen
  - 20.000 Mess-Iterationen
  - Request mit Instanz- und Organisationskontext

## Messergebnis

- `avg`: `0.0023 ms`
- `p50`: `0.0019 ms`
- `p95`: `0.0057 ms`
- `p99`: `0.0061 ms`
- `max`: `0.1936 ms`
- Zielwert: `p95 < 50 ms`
- Ergebnis: erfüllt (`withinTarget=true`)

## Einordnung

Die evaluator-nahe Messung liegt deutlich unter dem Zielwert. Für Produktionsfreigaben bleiben zusätzlich endpoint-nahe Messungen (inkl. DB, Cache, Netz, Lastprofil 100 RPS / 500 gleichzeitige Nutzer) erforderlich.

## Referenzen

- `docs/reports/iam-authorize-baseline-2026-02-27.md`
- `docs/reports/iam-authorization-testmatrix-2026-02-28.md`
