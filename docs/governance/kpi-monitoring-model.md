# KPI- und Monitoring-Modell für Governance-Erfolg

## Zielbild

Dieses Modell definiert ein verbindliches, messbares KPI-Set für die Governance von Branching, Merge-Queue und Preview-Betrieb. Alle KPIs sind numerisch, haben eine konkrete Messquelle und einen benannten Owner.

Das Modell baut auf folgenden Grundlagen auf:

- `docs/governance/merge-review-gates.md` (Merge- und Gate-SLA)
- `docs/governance/branch-protection-merge-queue-policy.md` (Queue-Eject-Logik)
- `docs/governance/preview-cost-capacity-guardrails.md` (Kosten/Kapazität)
- `docs/governance/rollout-plan.md` (Phasenziele)
- `README.md` und `docs/development/monitoring-stack.md` (OpenTelemetry, Prometheus, Grafana, Label-Schema)

## Messprinzipien

- Keine KPI ohne Messquelle (GitHub API, GitHub Actions API, Prometheus, Billing API oder Git).
- Keine KPI ohne Zielwert und Eskalationsschwelle.
- Monorepo-Auswertung auf zwei Ebenen: `global` (Repository) und `component` (Team-/Package-Sicht).
- Labels für Metriken bleiben innerhalb der Whitelist aus `README.md` und `docs/development/monitoring-stack.md`: `workspace_id`, `component`, `environment`, `level`.

## KPI-Set

### KPI 1: Merge-Zeit (PR Open -> Merge)

- Definition: Gemessene End-to-End-Dauer von PR-Erstellung bis Merge nach `main`.
- Formel: `merge_time_hours = avg((merged_at - created_at) in Stunden)` für alle in der Periode gemergten PRs.
- Quelle: GitHub REST API `GET /repos/{owner}/{repo}/pulls?state=closed&base=main`; Felder `created_at`, `merged_at`.
- Zielwert: `< 48 h` (Phase 1 Pilot gemäß `docs/governance/rollout-plan.md`).
- Alert-Schwelle: `>= 60 h` Tagesdurchschnitt oder `>= 48 h` in 3 aufeinanderfolgenden Tagesmessungen.
- Owner: Platform Team Lead.
- Erhebungsrhythmus: Täglich 08:00 UTC (rolling 24h) + Wochenreview.

### KPI 2: Konfliktrate

- Definition: Anteil der PRs mit Merge-Konflikt oder konfliktbedingter Queue-Ejection.
- Formel: `conflict_rate_pct = (prs_with_conflict / merged_or_closed_prs) * 100`.
- Quelle:
  - GitHub GraphQL API (`PullRequest.mergeable`, `potentialMergeCommit`) für Konfliktstatus.
  - GitHub REST API `GET /repos/{owner}/{repo}/issues/{issue_number}/events` für `head_ref_force_pushed` und Konflikt-/Rebase-Ereignisse.
  - Queue-Ejection-Signale aus Workflow-Logs (`queue-failed` Label).
- Zielwert: `< 15 %`.
- Alert-Schwelle: `>= 20 %` in einer Tagesmessung oder `>= 15 %` in 5 aufeinanderfolgenden Tagesmessungen.
- Owner: Maintainer-Gruppe (Codeowner-Rotation).
- Erhebungsrhythmus: Täglich + Trendanalyse wöchentlich.

### KPI 3: Queue-Stabilität (Eject-Rate)

- Definition: Anteil der Merge-Queue-Eintraege, die wegen Failed/Flaky/Timeout aus der Queue entfernt werden.
- Formel: `queue_eject_rate_pct = (queue_eject_total / queue_enqueue_total) * 100`.
- Quelle:
  - GitHub Actions API `GET /repos/{owner}/{repo}/actions/runs` (Queue-Workflows, Retry/Failure/Timeout).
  - Prometheus-Metriken aus Queue-Automation (z. B. `merge_queue_enqueue_total`, `merge_queue_eject_total`, `merge_queue_timeout_total`).
- Zielwert: `< 10 %` (Phase 1 KPI gemäß `docs/governance/rollout-plan.md`).
- Alert-Schwelle: `>= 12 %` pro Tag oder `>= 10 %` in 3 aufeinanderfolgenden Tagen.
- Owner: GitHub Organization Admins (mit Maintainer-Fallback).
- Erhebungsrhythmus: Täglich mit 15-Minuten-Inkrementen im Dashboard.

### KPI 4: Preview-Kosten

- Definition: Monatliche Preview-Kosten und Kosten je aktivem Preview-Tag zur Budgetsteuerung.
- Formel:
  - `preview_monthly_cost_eur = sum(preview_cost_estimated_eur)` pro Kalendermonat.
  - `cost_per_preview_day_eur = preview_monthly_cost_eur / sum(preview_active_days)`.
- Quelle:
  - Prometheus-Metrik `preview_cost_estimated_eur` aus Preview-Workflows.
  - Billing API der Zielplattform (Vercel API bzw. Cloud-Billing-API) zur Monatsabstimmung.
- Zielwert:
  - Pilot: `<= 500 EUR/Monat` (Monitoring-First Trigger aus `docs/governance/preview-cost-capacity-guardrails.md`).
  - Zusatz: `cost_per_preview_day_eur <= 1.50 EUR`.
- Alert-Schwelle:
  - Soft: `>= 90 %` des Monatsziels (`>= 450 EUR`) vor Monatsende.
  - Hard: `> 100 %` (`> 500 EUR`) oder Kostenanstieg `> 25 %` gegenüber Vormonat.
- Owner: Product Owner (Budget) und DevOps/SRE Lead (Betrieb).
- Erhebungsrhythmus: Täglich (kumuliert) + Monatsabschlussbericht.

### KPI 5: Branch-Staleness

- Definition: Anteil aktiver Arbeits-Branches, deren Alter die für den Branch-Typ definierte TTL überschreitet.
- Formel: `branch_staleness_pct = (stale_branches / active_work_branches) * 100`, wobei `stale` gilt, wenn `branch_age_days > policy_ttl_days`.
- Quelle:
  - Git-Quelle: `git for-each-ref refs/heads --format='%(refname:short) %(committerdate:unix)'`.
  - Mapping der TTL je Branch-Typ aus Governance-Dokumenten (`feature/*`, `fix/*`, `chore/*`, `stack/*`, `epic/*`).
  - Optionaler Abgleich über GitHub API `GET /repos/{owner}/{repo}/branches` für Remote-Only-Branches.
- Zielwert: `< 5 %`.
- Alert-Schwelle: `>= 8 %` in einer Messung oder `>= 5 %` in 2 aufeinanderfolgenden Wochen.
- Owner: Team Leads je `component` (globaler Owner: Platform Team).
- Erhebungsrhythmus: Woechentlich (Montag 07:00 UTC) + Monatsreport.

## Eskalationsmodell bei Governance-Degradation

### KPI-Statusklassen

- Gruen: KPI < Zielwert.
- Gelb: KPI >= Zielwert und < Alert-Schwelle.
- Rot: KPI >= Alert-Schwelle.

### Verbindliche Eskalation

- Stufe 1 (Operativ): KPI ist 1 Messung rot -> Owner-Benachrichtigung innerhalb 8 Stunden via Slack `#platform-governance` + GitHub Issue mit Label `governance:kpi-alert`.
- Stufe 2 (Taktisch): KPI ist 3 Messungen in Folge rot oder 5 Messungen gelb -> Review-Meeting innerhalb 24 Stunden, Maßnahmenplan mit Due Dates.
- Stufe 3 (Kritisch): Mindestens 3 KPIs gleichzeitig rot oder 1 KPI 7 Messungen in Folge rot -> Emergency Governance Review innerhalb 48 Stunden, Rollback-/Guardrail-Hardening gem. `docs/governance/rollout-plan.md` Fallback-Strategie.

## Integration in den Monitoring-Stack

### Datenerhebung und Persistenz

- GitHub APIs (Pulls, Actions, Events) werden per Scheduled Workflow abgefragt und als Timeseries exportiert.
- OpenTelemetry Collector übernimmt strukturierte KPI-Events; Prometheus speichert aggregierte KPI-Metriken.
- Grafana visualisiert KPI-Status in einem Governance-Dashboard mit Drilldown nach `component`.

### Prometheus/Grafana Anschluss

- Empfohlene Recording Rules:
  - `governance_merge_time_hours_avg`
  - `governance_conflict_rate_pct`
  - `governance_queue_eject_rate_pct`
  - `governance_preview_monthly_cost_eur`
  - `governance_branch_staleness_pct`
- Alerting über Alertmanager mit Severity-Mapping (`warning` für gelb, `critical` für rot).
- Label-Compliance: Nur erlaubte Labels aus dem Monitoring-Stack verwenden; keine PII-Labels.

## Rollout-Integration (Pilot -> Standard)

- Phase 1 (Pilot): Fokus auf `Merge-Zeit < 48 h` und `Queue-Eject-Rate < 10 %`.
- Phase 2 (Transition): KPI-Baseline für Konfliktrate und Branch-Staleness teamweit stabilisieren.
- Phase 3 (Enforcement): KPI-Alarme als Gate für Governance-Ausnahmen (Bypass nur P0/P1).
- Phase 4 (Standard): Kontinuierliche Optimierung, insbesondere sinkende Preview-Kosten pro Preview-Tag und stabile Staleness `< 5 %`.

## Monorepo-Verantwortung

- Globales Governance-Board (Platform + Maintainer + Product Owner) verantwortet Repository-Zielwerte.
- Team Leads verantworten KPI-Abweichungen in ihren `component`-Scopes.
- Monatsreview kombiniert `global`-Sicht (Repository) und `component`-Sicht (Packages/Teams), um lokale Hotspots sichtbar zu machen.
