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
5. Testqualität und Verifikationsabdeckung
6. Nutzbarkeit und internationale Konsistenz
7. Performance-Effizienz

### Messbare Kriterien (IST)

- Type Safety:
  - `pnpm test:types` muss grün sein
- Lint/Build Qualitaet:
  - `pnpm test:eslint` muss grün sein
  - `pnpm nx show project sva-studio-react` zeigt explizite Targets mit definierten `inputs` und `outputs`
- Unit-Test-Basis:
  - `pnpm test:unit` muss grün sein
- IAM Authorize Performance:
  - P95 für `POST /iam/authorize` < 50 ms (mindestens 100 RPS / 500 gleichzeitige Nutzer als Zielprofil)
- IAM Mandantenisolation (RLS):
  - Kein Datenzugriff über Organisations-/Instanzgrenzen (`instanceId`) hinweg
  - Negativtests für RLS-Bypass und Direktzugriff müssen grün sein
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
  - `pnpm check:file-placement` muss grün sein
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`
- Complexity Governance:
  - `pnpm complexity-gate` muss für definierte zentrale/kritische Module grün sein
  - neue Schwellwertüberschreitungen ohne Ticket-Referenz blockieren den Qualitätslauf
  - kritische Module können strengere Coverage-Mindestwerte und Datei-Hotspots erhalten
  - bei modularen Refactorings muss Restschuld auf den tatsächlich verbleibenden Kernmodulen getrackt werden
- Review-Governance:
  - Proposal- und PR-Reviews nutzen spezialisierte Agents mit standardisierten Templates
  - Trigger-Matrix und Abgrenzungen sind in `docs/development/review-agent-governance.md` dokumentiert

### Qualitätsattribute und Review-Zuordnung

- Reliability:
  - `test-quality.agent.md`
  - `operations-reliability.agent.md`
  - `logging.agent.md`
- Usability:
  - `user-journey-usability.agent.md`
- Accessibility:
  - `ux-accessibility.agent.md`
- Maintainability:
  - `code-quality-guardian.agent.md`
  - `documentation.agent.md`
- Security:
  - `security-privacy.agent.md`
- Performance Efficiency:
  - `performance.agent.md`
- Internationalization:
  - `i18n-content.agent.md`

### Observability-Qualität

- Strukturierte Logs mit Pflichtfeldern (`component`, `environment`, `workspace_id`)
- IAM-Authorize- und Cache-Logs enthalten zusätzlich `request_id` und `trace_id`
- Label-Whitelist und PII-Redaction entlang der OTEL-Pipeline
- Healthchecks für lokale Monitoring-Dienste in Compose
- DSR-Audit-Events enthalten mindestens `instance_id`, `request_id`, `trace_id`, `event_type`, `result`

### Aktuelle Lücken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschränkte Aussagekraft
- Fehlende oder implizite Cache-Inputs für Frontend-Tooling können zu falschen Cache-Hits führen, wenn neue App-Targets nicht konsistent gepflegt werden
- Mehrere IAM-Hotspots liegen bewusst über den Komplexitäts-Schwellwerten und werden über Refactoring-Tickets nachverfolgt
- Die neue modulare IAM-Fassade reduziert öffentliche Importflächen; vollständige Kernzerlegung bleibt für einzelne `core.ts`-Bausteine Folgearbeit

Referenzen:

- `../development/testing-coverage.md`
- `../development/complexity-quality-governance.md`
- `../development/review-agent-governance.md`
- `scripts/ci/coverage-gate.ts`
- `scripts/ci/complexity-gate.ts`
- `tooling/quality/complexity-policy.json`
- `packages/monitoring-client/src/otel.server.ts`

### Ergänzung 2026-03: Qualitätsziele IAM-UI

- Account-/Admin-UI muss auf 320px, 768px und 1024px funktionsfähig bleiben.
- IAM-Admin-Calls gegen Keycloak sollen bei Circuit-Breaker-Open deterministisch in den Degraded-Mode wechseln.
- Mutierende IAM-Endpunkte müssen CSRF-Header validieren.
- UI-Regressionen werden über Unit-Tests für Hooks und Seiten sowie E2E-Szenarien für Account/Admin abgesichert.

### Ergänzung 2026-03: Qualitätsziele Organisationsverwaltung

- Organisations-Read-Models müssen Parent-, Typ- und Zählerdaten ohne UI-seitige Rekursion bereitstellen.
- Org-Kontextwechsel darf den bestehenden `POST /iam/authorize`-Pfad nicht regressiv verschlechtern.
- Negativtests für CSRF, instanzfremde Kontexte, Zyklusverletzungen und Deaktivierungskonflikte müssen grün sein.
- Verifikationsnachweise für diesen Change werden in `docs/reports/iam-organization-management-verification-2026-03-09.md` festgehalten.

### Ergänzung 2026-03: Qualitätsziele strukturierte Permission-Vererbung

- Strukturierte Permission-Seeds und Migrationen müssen idempotent sein; `pnpm nx run data:db:migrate:validate` und `pnpm nx run data:db:test:seeds` müssen grün sein.
- `authorize`- und `me/permissions`-Pfad müssen Resource-Spezifität, `allow`/`deny` und Org-Vererbung deterministisch auflösen.
- Negativtests für restriktive Parent-/Child-Konflikte, Geo-Scope-Mismatches und fehlende Resource-IDs müssen grün sein.
- Der Kompatibilitätspfad von `permission_key` auf strukturierte Felder darf bestehende Permission-Reads nicht regressiv brechen.
