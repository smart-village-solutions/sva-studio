# Agent-exekutierbarer Governance-Prüfkatalog

## Ziel

Dieser Katalog übersetzt die Governance-Regeln aus T2-T14 in deterministische, tool-basierte Prüfungen mit klaren PASS/FAIL-Kriterien. Alle Kommandos sind ohne Platzhalter formuliert und im Kontext eines vollständig initialisierten Governance-/Evidence-Setups für `smart-village-solutions/sva-studio` direkt ausführbar.

## Prüfumfang

- Branch-Taxonomie und Naming
- Stacked-PR-Regeln
- Merge- und Review-Gates
- CODEOWNERS-Strategie
- Preview-Lifecycle
- Kosten- und Kapazitätsleitplanken
- Security- und Compliance-Leitplanken
- Branch-Protection und Merge Queue
- Broken-Main und Hotfix-SOP
- KPI- und Monitoring-Modell

---

### Check #1: Branch-Prefixe und Namensregex sind verbindlich dokumentiert

Governance Source: T2 - branch-taxonomy.md
Tool: `bash`
Command:
```bash
grep -E "^-[[:space:]]Regex \(final\):" docs/governance/branch-taxonomy.md
```
Expected:
```
- Regex (final): ^(feature|fix|chore|stack|epic)/[a-z0-9]+(-[a-z0-9]+)*$
```
Failure:
- Regex fehlt oder weicht vom finalen Pattern ab
- `stack` ist im Pattern nicht enthalten
Frequency: on_demand

---

### Check #2: Hook-Migrationslücke für `stack/` ist explizit sichtbar

Governance Source: T2 - branch-taxonomy.md + .githooks/reference-transaction
Tool: `bash`
Command:
```bash
grep -E "^prefixes='" .githooks/reference-transaction && grep -F '`stack/` ist im Hook noch nicht freigeschaltet.' docs/governance/branch-taxonomy.md
```
Expected:
```
prefixes='feature|fix|chore|docs|setup|adr|hotfix|epic|release|refactor|dev'
- `stack/` ist im Hook noch nicht freigeschaltet.
```
Failure:
- Hook-Zeile nicht auffindbar
- Governance-Hinweis zur Migration fehlt
Frequency: weekly

---

### Check #3: TTL-Matrix für Branch-Klassen ist numerisch gesetzt

Governance Source: T3 - stacked-pr-rules.md
Tool: `bash`
Command:
```bash
grep -A10 "ttl_days:" docs/governance/stacked-pr-rules.md
```
Expected:
```
ttl_days:
  fix: 3
  chore: 7
  feature: 7
  stack: 7
  epic: 14
```
Failure:
- Einer der TTL-Werte fehlt
- Ein TTL-Wert ist nicht numerisch
Frequency: daily

---

### Check #4: Maximale Stack-Tiefe ist auf 3 begrenzt

Governance Source: T3 - stacked-pr-rules.md
Tool: `bash`
Command:
```bash
grep -E 'max_stack_depth:[[:space:]]*3|`max_stack_depth = 3`' docs/governance/stacked-pr-rules.md
```
Expected:
```
max_stack_depth: 3
```
Failure:
- Stack-Tiefe nicht definiert
- Wert ist ungleich 3
Frequency: per_PR

---

### Check #5: Rebase-Kadenz und Parent-Merge-Fenster sind festgelegt

Governance Source: T3 - stacked-pr-rules.md
Tool: `bash`
Command:
```bash
grep -A8 "rebase:" docs/governance/stacked-pr-rules.md
```
Expected:
```
rebase:
  cadence_hours: 24
  after_parent_merge_hours: 2
  stale_ahead_or_behind_hours: 24
```
Failure:
- `cadence_hours` fehlt
- `after_parent_merge_hours` fehlt
Frequency: daily

---

### Check #6: Stale-Detection verwendet vier harte Trigger

Governance Source: T3 - stacked-pr-rules.md
Tool: `bash`
Command:
```bash
grep -A8 "stale_detection:" docs/governance/stacked-pr-rules.md
```
Expected:
```
stale_detection:
  no_commit_hours: 48
  no_rebase_hours: 24
  unresolved_conflict_hours: 8
  ttl_breach_hours: 0
```
Failure:
- Weniger als vier Stale-Trigger vorhanden
- `ttl_breach_hours` ist nicht 0
Frequency: daily

---

### Check #7: Eskalationspfad 8h/24h/48h ist vollständig

Governance Source: T3 - stacked-pr-rules.md
Tool: `bash`
Command:
```bash
grep -A16 "escalation:" docs/governance/stacked-pr-rules.md
```
Expected:
```
due_hours: 8
due_hours: 24
due_hours: 48
```
Failure:
- Ein Eskalationslevel fehlt
- Fälligkeiten sind nicht 8/24/48 Stunden
Frequency: weekly

---

### Check #8: Required Checks sind exakt benannt

Governance Source: T4 - merge-review-gates.md
Tool: `bash`
Command:
```bash
grep -E '`(Lint / lint|Unit / unit|Types / types|Coverage and Quality Gates / Coverage Gate|Coverage and Quality Gates / Complexity Gate|Coverage and Quality Gates / PR Integration Gate|App E2E Smoke / App E2E Smoke)`' docs/governance/merge-review-gates.md
```
Expected:
```
`Lint / lint`
`Unit / unit`
`Types / types`
`Coverage and Quality Gates / Coverage Gate`
`Coverage and Quality Gates / Complexity Gate`
`Coverage and Quality Gates / PR Integration Gate`
`App E2E Smoke / App E2E Smoke`
```
Failure:
- Einer der dokumentierten Check-Namen fehlt
- Check-Name ist umbenannt oder unspezifisch
Frequency: per_PR

---

### Check #9: E2E-Pfadkonditionen sind dokumentiert

Governance Source: T4 - merge-review-gates.md
Tool: `bash`
Command:
```bash
grep -F "nur bei Pfadtreffern" docs/governance/merge-review-gates.md && grep -F "apps/sva-studio-react/**" docs/governance/merge-review-gates.md
```
Expected:
```
`App E2E Smoke / App E2E Smoke` ... nur bei Pfadtreffern
apps/sva-studio-react/**
```
Failure:
- Konditionale E2E-Regel fehlt
- Referenzpfad für App-Änderungen fehlt
Frequency: per_PR

---

### Check #10: Review-Mindestwerte (1/2) sind festgelegt

Governance Source: T4 - merge-review-gates.md
Tool: `bash`
Command:
```bash
grep -E "Mindestanzahl Reviews.*\*\*1\*\*|kritische Pfade.*\*\*2\*\*" docs/governance/merge-review-gates.md
```
Expected:
```
Mindestanzahl Reviews ... 1
kritische Pfade ... 2 Approvals
```
Failure:
- Allgemeines Minimum von 1 fehlt
- Kritische Pfade mit 2 Approvals fehlen
Frequency: per_PR

---

### Check #11: Merge-Queue-Aktivierung nutzt numerische Trigger

Governance Source: T4/T10 - merge-review-gates.md + branch-protection-merge-queue-policy.md
Tool: `bash`
Command:
```bash
grep -E 'mindestens `2`|`> 30`|kritischen Pfad' docs/governance/branch-protection-merge-queue-policy.md
```
Expected:
```
mindestens `2` merge-ready PRs
kritischen Pfad
mehr als `30` Dateien
```
Failure:
- Ein Aktivierungskriterium fehlt
- Numerische Trigger nicht klar angegeben
Frequency: daily

---

### Check #12: CODEOWNERS-Fallback auf Maintainers ist vorhanden

Governance Source: T5 - codeowners-strategy.md
Tool: `bash`
Command:
```bash
grep -F "*                                       @sva-studio/maintainers" docs/governance/codeowners-strategy.md
```
Expected:
```
*                                       @sva-studio/maintainers
```
Failure:
- Kein globaler Fallback-Owner vorhanden
- Fallback verweist nicht auf `@sva-studio/maintainers`
Frequency: weekly

---

### Check #13: Kritische Pfade sind mit Ownern belegt

Governance Source: T5 - codeowners-strategy.md
Tool: `bash`
Command:
```bash
grep -E "(/packages/core/|/packages/auth-runtime/|/packages/iam-admin/|/packages/iam-governance/|/packages/instance-registry/|\.github/workflows/).+@sva-studio/" docs/governance/codeowners-strategy.md
```
Expected:
```
/packages/core/                         @sva-studio/core-maintainers
/packages/auth-runtime/                 @sva-studio/security-team @sva-studio/core-maintainers
.github/workflows/                      @sva-studio/infrastructure @sva-studio/security-team
```
Failure:
- Kritischer Pfad ohne Team-Zuordnung
- Owner-Zuweisung ist leer oder unvollständig
Frequency: weekly

---

### Check #14: Schutzoptionen für `main` sind aktiv vorgeschrieben

Governance Source: T10 - branch-protection-merge-queue-policy.md
Tool: `bash`
Command:
```bash
grep -E 'Dismiss stale approvals: aktiviert|Require conversation resolution before merge: aktiviert|Force-push auf `main`: verboten|Deletion von `main`: verboten' docs/governance/branch-protection-merge-queue-policy.md
```
Expected:
```
Dismiss stale approvals: aktiviert.
Require conversation resolution before merge: aktiviert.
Force-push auf `main`: verboten.
Deletion von `main`: verboten.
```
Failure:
- Eine Schutzoption fehlt
- Schutzoption ist nicht als verbindlich markiert
Frequency: per_PR

---

### Check #15: Required Status Checks in GitHub Branch Protection stimmen mit Governance überein

Governance Source: T10 - branch-protection-merge-queue-policy.md
Tool: `gh`
Command:
```bash
gh api repos/smart-village-solutions/sva-studio/branches/main/protection | jq -r '.required_status_checks.contexts[]' | sort
```
Expected:
```
App E2E Smoke / App E2E Smoke
Coverage and Quality Gates / Complexity Gate
Coverage and Quality Gates / Coverage Gate
Coverage and Quality Gates / PR Integration Gate
Lint / lint
Types / types
Unit / unit
```
Failure:
- Einer der dokumentierten Required Checks fehlt
- Kontextliste ist `null`
- Zusätzliche, nicht freigegebene Gate-Namen sind als required gesetzt
Frequency: per_PR

---

### Check #16: Bypass ist auf P0/P1 plus Audit-Spur beschränkt

Governance Source: T10 - branch-protection-merge-queue-policy.md
Tool: `bash`
Command:
```bash
grep -E "P0/P1|Incident-Issue|PR-Kommentar|freigebenden verantwortlichen Rolle" docs/governance/branch-protection-merge-queue-policy.md
```
Expected:
```
Bypass ist nur bei Produktionsvorfällen P0/P1 erlaubt.
Verlinktes GitHub Incident-Issue.
PR-Kommentar ... Risikoabschätzung.
Nennung der freigebenden verantwortlichen Rolle.
```
Failure:
- P0/P1-Begrenzung fehlt
- Audit-Felder sind unvollständig
Frequency: per_PR

---

### Check #17: Preview-Event-Mapping hat exakt drei deterministische Events

Governance Source: T7 - preview-lifecycle-policy.md
Tool: `bash`
Command:
```bash
grep -E '\| `opened` \||\| `synchronize` \||\| `closed` \|' docs/governance/preview-lifecycle-policy.md
```
Expected:
```
| `opened` | `CREATE_AND_PUBLISH` |
| `synchronize` | `UPDATE_AND_REPUBLISH` |
| `closed` | `DESTROY_AND_CLEANUP` |
```
Failure:
- Eines der drei Events fehlt
- Event ist keinem eindeutigen Lifecycle-Schritt zugeordnet
Frequency: per_PR

---

### Check #18: Preview-URL wird über drei Kanäle und Reihenfolge publiziert

Governance Source: T7 - preview-lifecycle-policy.md
Tool: `bash`
Command:
```bash
grep -E "Deployment API|Status Check|PR-Kommentar|Deployment API -> Status Check -> Sticky Kommentar" docs/governance/preview-lifecycle-policy.md
```
Expected:
```
Deployment API (kanonisch)
Status Check: preview/url-published
PR-Kommentar (sticky)
Deployment API -> Status Check -> Sticky Kommentar
```
Failure:
- Einer der drei Veröffentlichungskanäle fehlt
- Reihenfolge ist nicht definiert
Frequency: per_PR

---

### Check #19: Closed-Event Cleanup-SLA und Deprovisioning-Budget sind gesetzt

Governance Source: T7 - preview-lifecycle-policy.md
Tool: `bash`
Command:
```bash
grep -E '15 Minuten|2 Stunden|Hard-TTL: `14` Tage|Inaktivitaets-TTL: `7` Tage' docs/governance/preview-lifecycle-policy.md
```
Expected:
```
Reaktions-SLA ... innerhalb von `15` Minuten
Deprovisioning-Zeitbudget ... innerhalb von `2` Stunden
Inaktivitaets-TTL: `7` Tage
Hard-TTL: `14` Tage
```
Failure:
- Cleanup-SLA fehlt
- Hard-TTL oder Inaktivitäts-TTL fehlt
Frequency: daily

---

### Check #20: Preview-Cleanup-Fehlerpfad hat Retry, Eskalation und Sweep-Job

Governance Source: T7 - preview-lifecycle-policy.md
Tool: `bash`
Command:
```bash
grep -E 'Retry 1: nach `5` Minuten|Retry 2: nach `15` Minuten|Retry 3: nach `60` Minuten|Incident-Label `preview-cleanup-failed`|Sweep-Job \(`24` Stunden Takt\)' docs/governance/preview-lifecycle-policy.md
```
Expected:
```
Retry 1: nach `5` Minuten
Retry 2: nach `15` Minuten
Retry 3: nach `60` Minuten
Incident-Label `preview-cleanup-failed`
Sweep-Job (`24` Stunden Takt)
```
Failure:
- Retry-Logik unvollständig
- Eskalationslabel fehlt
- Kein Zombie-Sweep dokumentiert
Frequency: daily

---

### Check #21: Kapazitätslimit und Queue-Limit sind numerisch definiert

Governance Source: T8 - preview-cost-capacity-guardrails.md
Tool: `bash`
Command:
```bash
grep -E 'max_active_previews`: `10`|Maximale Queue-Länge: `5` PRs' docs/governance/preview-cost-capacity-guardrails.md
```
Expected:
```
max_active_previews: 10
Maximale Queue-Länge: 5 PRs
```
Failure:
- Active-Preview-Limit fehlt
- Queue-Limit fehlt
Frequency: daily

---

### Check #22: Priority-High-Budget und automatische Rückstufung sind festgelegt

Governance Source: T8 - preview-cost-capacity-guardrails.md
Tool: `bash`
Command:
```bash
grep -E '2 Labels pro Team pro Woche|automatisch auf `priority:default` zurückgesetzt' docs/governance/preview-cost-capacity-guardrails.md
```
Expected:
```
priority:high ... limitiert auf 2 Labels pro Team pro Woche
Label wird automatisch auf `priority:default` zurückgesetzt
```
Failure:
- Kein numerisches Priorisierungsbudget
- Keine automatisierte Enforcement-Aktion
Frequency: weekly

---

### Check #23: Idle-Cleanup-Lifecycle enthält Stale (7d), Destroy (14d), Keep-Limit

Governance Source: T8 - preview-cost-capacity-guardrails.md
Tool: `bash`
Command:
```bash
grep -E 'Stale-Schwelle.*7 Tage|Auto-Destroy-Schwelle.*14 Tage|Maximale Verlängerungen: `2x`' docs/governance/preview-cost-capacity-guardrails.md
```
Expected:
```
Stale-Schwelle: 7 Tage
Auto-Destroy-Schwelle: 14 Tage
Maximale Verlängerungen: 2x
```
Failure:
- 7-Tage-Stale-Regel fehlt
- 14-Tage-Destroy-Regel fehlt
- Keep-Verlängerung nicht begrenzt
Frequency: daily

---

### Check #24: T8-Fehlerpfad dokumentiert Retry 3x + SRE-Eskalation 24h

Governance Source: T8 - preview-cost-capacity-guardrails.md
Tool: `bash`
Command:
```bash
grep -E 'Retry-Logik: 3 Versuche im Abstand von `5 Minuten`|SRE-Team muss innerhalb von 24 Stunden' docs/governance/preview-cost-capacity-guardrails.md
```
Expected:
```
Retry-Logik: 3 Versuche im Abstand von 5 Minuten
SRE-Team muss innerhalb von 24 Stunden manuell bereinigen
```
Failure:
- Retry-Strategie nicht vorhanden
- Eskalations-SLA fehlt
Frequency: daily

---

### Check #25: Secret-Quellen sind plattformspezifisch und exklusiv

Governance Source: T9 - preview-security-compliance-guardrails.md
Tool: `bash`
Command:
```bash
grep -A6 "secret_handling:" docs/governance/preview-security-compliance-guardrails.md
```
Expected:
```
vercel: github_secrets_only
self_hosted: vault_only
```
Failure:
- Vercel nicht auf `github_secrets_only` festgelegt
- Self-hosted nicht auf `vault_only` festgelegt
Frequency: per_PR

---

### Check #26: Hardcoded Credentials sind als Zero-Tolerance-Verstoß markiert

Governance Source: T9 - preview-security-compliance-guardrails.md
Tool: `bash`
Command:
```bash
grep -E "hardcoded_credentials:|forbidden: true|forbidden_locations" docs/governance/preview-security-compliance-guardrails.md
```
Expected:
```
hardcoded_credentials:
  forbidden: true
  forbidden_locations:
```
Failure:
- `forbidden: true` fehlt
- Verbotene Fundorte nicht aufgelistet
Frequency: per_PR

---

### Check #27: PII-Datenklassen und Incident-SLA sind festgelegt

Governance Source: T9 - preview-security-compliance-guardrails.md
Tool: `bash`
Command:
```bash
grep -E "allowed_data_classes|test_data|sanitized_data|synthetic_data|incident_report_deadline_hours: 2" docs/governance/preview-security-compliance-guardrails.md
```
Expected:
```
allowed_data_classes: test_data, sanitized_data, synthetic_data
incident_report_deadline_hours: 2
```
Failure:
- Erlaubte Datenklassen unvollständig
- 2h-Report-SLA fehlt
Frequency: per_PR

---

### Check #28: Secret-Leak-Reaktion startet innerhalb von 60 Minuten

Governance Source: T9 - preview-security-compliance-guardrails.md
Tool: `bash`
Command:
```bash
grep -E "response_start_deadline_minutes: 60|owner: security_team|rotate_exposed_secrets|audit_access_logs" docs/governance/preview-security-compliance-guardrails.md
```
Expected:
```
owner: security_team
response_start_deadline_minutes: 60
rotate_exposed_secrets
audit_access_logs
```
Failure:
- Owner nicht gesetzt
- 60-Minuten-SLA fehlt
- Pflichtaktionen unvollständig
Frequency: per_PR

---

### Check #29: Broken-Main-Kette Detection -> Owner -> Mitigation -> Verification ist vollständig

Governance Source: T13 - broken-main-hotfix-sop.md
Tool: `bash`
Command:
```bash
grep -E "1\. Detection|2\. Owner-Übernahme|3\. Mitigation|4\. Verification|30 Minuten" docs/governance/broken-main-hotfix-sop.md
```
Expected:
```
1. Detection
2. Owner-Übernahme
3. Mitigation
4. Verification
30 Minuten
```
Failure:
- Ketten-Schritt fehlt
- 30-Minuten-SLA fehlt
Frequency: per_PR

---

### Check #30: Revert-first ist Default, Forward-Fix nur unter vier Bedingungen

Governance Source: T13 - broken-main-hotfix-sop.md
Tool: `bash`
Command:
```bash
grep -E "Revert-first|Forward-Fix|time_to_fix|time_to_revert|Fehlt eine Bedingung, ist unverzüglich auf Revert zurückzuschalten" docs/governance/broken-main-hotfix-sop.md
```
Expected:
```
Default-Strategie: Revert-first
Forward-Fix ... nur zulässig, wenn alle Bedingungen erfüllt sind
time_to_fix < time_to_revert
Fehlt eine Bedingung ... auf Revert zurückzuschalten
```
Failure:
- Revert-first nicht als Default markiert
- Forward-Fix-Bedingungen unvollständig
Frequency: per_PR

---

### Check #31: KPI-Set enthält genau fünf Governance-KPIs

Governance Source: T14 - kpi-monitoring-model.md
Tool: `bash`
Command:
```bash
grep -E "^### KPI [1-5]:" docs/governance/kpi-monitoring-model.md | wc -l
```
Expected:
```
5
```
Failure:
- Anzahl KPI-Abschnitte ist ungleich 5
- KPI-Überschriften sind nicht numerisch strukturiert
Frequency: weekly

---

### Check #32: Jede KPI-Sektion enthält 7 Pflichtfelder

Governance Source: T14 - kpi-monitoring-model.md
Tool: `bash`
Command:
```bash
grep -E "Definition:|Formel:|Quelle:|Zielwert:|Alert-Schwelle:|Owner:|Erhebungsrhythmus:" docs/governance/kpi-monitoring-model.md | wc -l
```
Expected:
```
35
```
Failure:
- Trefferanzahl kleiner als 35
- Mindestens ein Pflichtfeld fehlt in einer KPI-Sektion
Frequency: weekly

---

### Check #33: KPI-Datenquellen sind nur aus erlaubten Systemen

Governance Source: T14 - kpi-monitoring-model.md
Tool: `bash`
Command:
```bash
grep -E "GitHub REST API|GitHub GraphQL API|GitHub Actions API|Prometheus|Billing API|Git-Quelle" docs/governance/kpi-monitoring-model.md
```
Expected:
```
GitHub REST API
GitHub GraphQL API
GitHub Actions API
Prometheus
Billing API
Git-Quelle
```
Failure:
- Datenquelle außerhalb des freigegebenen Sets
- Eine zentrale Datenquelle fehlt
Frequency: weekly

---

### Check #34: KPI-Eskalation folgt 8h/24h/48h-Modell

Governance Source: T14 - kpi-monitoring-model.md
Tool: `bash`
Command:
```bash
grep -E "innerhalb 8 Stunden|innerhalb 24 Stunden|innerhalb 48 Stunden" docs/governance/kpi-monitoring-model.md
```
Expected:
```
Stufe 1 ... innerhalb 8 Stunden
Stufe 2 ... innerhalb 24 Stunden
Stufe 3 ... innerhalb 48 Stunden
```
Failure:
- Eine Eskalationsstufe fehlt
- Eskalationszeiten sind nicht numerisch definiert
Frequency: daily

---

### Check #35: CI-Quelle für Coverage-Gate entspricht Governance-Referenz

Governance Source: T4/T10 - merge-review-gates.md + test-coverage.yml
Tool: `bash`
Command:
```bash
grep -E "name: Coverage and Quality Gates|jobs:|coverage:" .github/workflows/test-coverage.yml && grep -F "Workflow .github/workflows/test-coverage.yml, Job \`coverage\`" docs/governance/merge-review-gates.md
```
Expected:
```
name: Coverage and Quality Gates
coverage:
Workflow .github/workflows/test-coverage.yml, Job `coverage`
```
Failure:
- Coverage-Job ist in Workflow nicht vorhanden
- Governance-Referenz auf Workflow/Job fehlt
Frequency: per_PR

---

### Check #36: PR-Checklist enthält Pflichtchecks für Lint/Types/Unit/File-Placement

Governance Source: T4/T13 - docs/reports/PR_CHECKLIST.md
Tool: `bash`
Command:
```bash
grep -E "pnpm test:eslint|pnpm test:types|pnpm test:unit|pnpm check:file-placement" docs/reports/PR_CHECKLIST.md
```
Expected:
```
pnpm test:eslint
pnpm test:types
pnpm test:unit
pnpm check:file-placement
```
Failure:
- Ein Pflichtcheck fehlt in der PR-Checkliste
- Checkliste enthält keine file-placement-Validierung
Frequency: per_PR

---

## Empfohlene Ausführungsreihenfolge

1. T2/T3/T4/T5 Struktur- und Gate-Prüfungen (Checks 1-13)
2. T10 Enforcement gegen GitHub-API (Checks 14-16)
3. T7/T8 Lifecycle, Kapazität, Fehlerpfade (Checks 17-24)
4. T9 Security/Compliance und Incident-SLAs (Checks 25-28)
5. T13 Incident-Runbook-Integrität (Checks 29-30)
6. T14 KPI-Mess- und Eskalationsmodell (Checks 31-34)
7. Cross-Source-Validierung CI und PR-Checklist (Checks 35-36)

## Deterministische Pass/Fail-Auswertung

- PASS: `Expected`-Output ist vollständig vorhanden und `Failure`-Indikatoren treten nicht auf.
- FAIL: mindestens ein `Failure`-Indikator trifft zu oder `Expected` ist unvollständig.
- BLOCKER: Checks 15, 16, 20, 24, 28, 29, 30 schlagen fehl.
