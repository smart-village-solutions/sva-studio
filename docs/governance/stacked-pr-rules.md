# Stacked-PR-Regeln

## Ziel und Geltungsbereich

Diese Regeln gelten fuer alle Branches und Pull Requests im Trunk-plus-Stacked-Modell. Alle Grenzwerte sind numerisch definiert und fuer automatische Checks ausgelegt.

## Maschinenpruefbare Policy

```yaml
policy_version: 1
max_stack_depth: 3
ttl_days:
  fix: 3
  chore: 7
  feature: 7
  stack: 7
  epic: 14
rebase:
  cadence_hours: 24
  after_parent_merge_hours: 2
  stale_ahead_or_behind_hours: 24
  automated_trigger:
    schedule_cron: "0 */6 * * *"
    pull_request_event: true
    push_event: true
stale_detection:
  no_commit_hours: 48
  no_rebase_hours: 24
  unresolved_conflict_hours: 8
  ttl_breach_hours: 0
escalation:
  level_1:
    owner: pr_author
    action: "Rebase oder PR schliessen"
    due_hours: 8
  level_2:
    owner: codeowners
    action: "Branch splitten/retargeten und Reviewer neu zuweisen"
    due_hours: 24
  level_3:
    owner: repo_maintainers
    action: "Merge-Block setzen und Branch archivieren"
    due_hours: 48
```

## Regel 1: Maximale Stack-Tiefe

- `max_stack_depth = 3`.
- Definition Tiefe: Anzahl aufeinanderfolgender offenen PR-Abhaengigkeiten von `main` bis zum Blatt-PR.
- Verbot: Tiefe `> 3`.
- Technische Pruefung: Graph-Pruefung ueber PR-Base-Branch-Kette (`head -> base -> ... -> main`) pro offenem PR.

## Regel 2: TTL pro Branch-Klasse

- TTL startet bei `branch_created_at`.
- Branch-Klasse wird aus Prefix gelesen (`fix/`, `chore/`, `feature/`, `stack/`, `epic/`).
- Verbot: `now - branch_created_at > ttl_days[class]`.
- Grenzwerte:
  - `fix`: 3 Tage
  - `chore`: 7 Tage
  - `feature`: 7 Tage
  - `stack`: 7 Tage
  - `epic`: 14 Tage
- Durchsetzung bei TTL-Verletzung: Label `governance/ttl-violated` setzen und Merge blockieren.

## Regel 3: Rebase-Frequenz und Trigger

- Pflicht-Rebase mindestens alle `24` Stunden fuer offene Stack-PRs.
- Zusatzregel: Nach Merge des Parent-PR muss Kind-Branch innerhalb von `2` Stunden auf den neuen Upstream synchronisiert sein.
- Verbot: `branch_behind_base_age_hours > 24`.
- Automatische Trigger:
  - `schedule`: alle `6` Stunden (`0 */6 * * *`)
  - `pull_request` Event
  - `push` Event
- Durchsetzung: Label `governance/rebase-required` und Status `failure` fuer Governance-Check.

## Regel 4: Stale Detection

- Ein PR gilt als stale, wenn mindestens ein Kriterium zutrifft:
  1. `hours_since_last_commit > 48`
  2. `hours_since_last_rebase > 24`
  3. `hours_in_conflict_state > 8`
  4. `ttl_overrun_hours > 0`
- Aktion bei stale: Label `governance/stale` setzen, Auto-Kommentar mit konkreter Restfrist.

## Regel 5: Eskalationspfad

- Level 1 (8h): Owner `pr_author` behebt Rebase/TTL-Verstoss oder schliesst PR.
- Level 2 (24h): Owner `codeowners` splitten/retargeten den Stack und aktualisieren Reviewer.
- Level 3 (48h): Owner `repo_maintainers` setzen Merge-Block und archivieren ueberfaelligen Branch.
- Wenn eine Frist ueberschritten wird, wird automatisch das naechste Eskalationslevel aktiviert.

## Enforcement-Mechanismus (Check-Definition)

- Pflicht-Check: `stacked-pr-governance` als Required Status Check im Branch-Schutz.
- Inputs (GitHub API):
  - `created_at`, `updated_at`, `head.ref`, `base.ref`, `mergeable_state`, Commit-Historie
  - Parent-PR-Mergezeitpunkt fuer `after_parent_merge_hours`
- Ergebnislogik:
  - `pass`: alle Regeln eingehalten
  - `fail`: mindestens eine Regel verletzt
  - `warn`: nur Vorwarnung bei `ttl_remaining_hours <= 24`

## Referenz fuer CI-Implementierung

- Geplante Workflow-Datei: `.github/workflows/stacked-pr-governance.yml` (zum Zeitpunkt dieses Dokuments noch nicht im Repository angelegt).
- Job-Frequenz muss den Triggern entsprechen (`schedule` alle 6h plus `pull_request` und `push`).
- Bei `fail` muss der Job mit Exit-Code `1` enden.
