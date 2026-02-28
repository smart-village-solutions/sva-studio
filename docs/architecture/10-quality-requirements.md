# 10 Qualitätsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitätsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitätsziele (z. B. Sicherheit, Wartbarkeit, Verfügbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitätsziele

1. Sicherheit/Datenschutz
2. Wartbarkeit und Nachvollziehbarkeit
3. Beobachtbarkeit und Betrieb
4. Typsicherheit und Integrationsstabilität

### Messbare Kriterien (IST)

- Type Safety:
  - `pnpm test:types` muss gruen sein
- Lint/Build Qualitaet:
  - `pnpm test:eslint` muss gruen sein
- Unit-Test-Basis:
  - `pnpm test:unit` muss gruen sein
- IAM Authorize Performance:
  - P95 fuer `POST /iam/authorize` < 50 ms (mindestens 100 RPS / 500 gleichzeitige Nutzer als Zielprofil)
- IAM Mandantenisolation (RLS):
  - Kein Datenzugriff über Organisations-/Instanzgrenzen (`instanceId`) hinweg
  - Negativtests für RLS-Bypass und Direktzugriff müssen gruen sein
- IAM Cache-Invaliderung:
  - End-to-End-Latenz P95 <= 2 s, P99 <= 5 s
  - Snapshot-TTL = 300 s, maximal tolerierte Stale-Dauer = 300 s
- DSGVO-Betroffenenrechte (IAM):
  - Soft-Delete nach gültigem Löschantrag innerhalb von 48 Stunden
  - Datenexport in JSON/CSV/XML verfügbar (sync/async je nach Datenumfang)
  - Legal Holds blockieren finale Löschung deterministisch
  - Art.-19-Nachweise für Berichtigung/Löschung/Einschränkung vollständig dokumentiert
  - Wartungslauf verarbeitet Exportjobs, Eskalationen und Finalisierungen nachvollziehbar
- UI-Shell-Qualität:
  - Landmarks (`header`, `aside`, `main`) und Skip-Link vorhanden
  - Skeleton-Zustand für Sidebar, Kopfzeile und Contentbereich vorhanden
  - Responsives Verhalten für mobile und desktop geprüft
- File-Placement Governance:
  - `pnpm check:file-placement` muss gruen sein
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`

### Observability-Qualität

- Strukturierte Logs mit Pflichtfeldern (`component`, `environment`, `workspace_id`)
- IAM-Authorize- und Cache-Logs enthalten zusätzlich `request_id` und `trace_id`
- Label-Whitelist und PII-Redaction entlang der OTEL-Pipeline
- Healthchecks fuer lokale Monitoring-Dienste in Compose
- DSR-Audit-Events enthalten mindestens `instance_id`, `request_id`, `trace_id`, `event_type`, `result`

### Aktuelle Lücken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschraenkte Aussagekraft

Referenzen:

- `../development/testing-coverage.md`
- `scripts/ci/coverage-gate.ts`
- `packages/monitoring-client/src/otel.server.ts`
