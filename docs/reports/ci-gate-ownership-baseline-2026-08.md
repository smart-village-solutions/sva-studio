# Ownership- und Kostenbaseline der CI-Gates im August 2026

## Zweck und Stand

Diese Baseline beschreibt die allgemeine PR- und Main-Orchestrierung vor dem
Change `refactor-ci-gate-orchestration`. Sie trennt fachliche Schutzverträge
von wiederholter Workflow-Orchestrierung und bildet die Vergleichsbasis für
Shadow, Cutover und Löschbilanz.

- Erhebung: 28. August 2026
- Repository-Commit: `6b1ae3ae566a9c81caf1542e02f64ca0dcbedd16`
- Live-Ruleset: `11600196`, `Protections for default branch`, Enforcement
  `active`
- Ruleset-Abfrage:
  `gh api repos/smart-village-solutions/sva-studio/rulesets/11600196`
- OpenSpec-Voraussetzung: `accelerate-pr-failure-feedback` ist archiviert; die
  Tasks 0.5, 7.1, 7.4, 8.4 und 8.5 sind fachlich abgeschlossen.

## Live Required Checks

Das Ruleset verlangt für den Default-Branch exakt diese sieben Kontexte:

1. `Lint`
2. `Unit`
3. `Types`
4. `Complexity`
5. `PR Integration`
6. `File Placement`
7. `Coverage`

Diese Namen sind öffentliche Migrationsanker. `A11y`, `App Build`,
`Documentation Integrity`, `Documentation Catalog (advisory)` und
`DB Schema Snapshot` sind zusätzliche Signale, aber am Erhebungstag keine
Required-Kontexte dieses Rulesets.

## Workflow- und Jobmatrix

`needs: –` bedeutet, dass der Job unabhängig startet. Shell-interne
Relevanzprüfungen ändern nichts daran, dass Checkout und häufig das vollständige
Workspace-Setup bereits erfolgt sind.

| Workflow                 | Trigger                  | Job / Kontext                               | `needs`                               | Einordnung                         | Zweck                                                                     |
| ------------------------ | ------------------------ | ------------------------------------------- | ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `quality-gates.yml`      | PR, Push `main`          | `Lint`                                      | –                                     | required                           | betroffener oder vollständiger Lint-Vertrag                               |
| `quality-gates.yml`      | PR                       | `Unit Fast Feedback`                        | –                                     | intern                             | direkt geänderte Unit-Projekte und App-Slices                             |
| `quality-gates.yml`      | PR, Push `main`          | `Unit Complete` im PR, sonst `Unit`         | –                                     | intern im PR, Main-Signal          | disjunkter Rest beziehungsweise vollständiger Main-Unit-Scope             |
| `quality-gates.yml`      | PR                       | `Unit`                                      | `Unit Fast Feedback`, `Unit Complete` | required                           | fail-closed Aggregation der Unit-Evidenz                                  |
| `quality-gates.yml`      | PR, Push `main`          | `Types`                                     | –                                     | required im PR                     | betroffene oder vollständige Type-/Runtime-Prüfung                        |
| `quality-gates.yml`      | PR, Push `main`          | `A11y`                                      | –                                     | informativ                         | Accessibility-Gate                                                        |
| `runtime-gates.yml`      | PR, Push `main`, Nightly | `Coverage Complete` im PR, sonst `Coverage` | –                                     | intern im PR, Main-/Nightly-Signal | Changed-first beziehungsweise vollständige Coverage samt Floors und Sonar |
| `runtime-gates.yml`      | PR                       | `Coverage`                                  | `Coverage Complete`                   | required                           | fail-closed Aggregation der Coverage-Evidenz                              |
| `runtime-gates.yml`      | PR, Push `main`, Nightly | `Complexity`                                | –                                     | required im PR                     | Complexity-Gate                                                           |
| `runtime-gates.yml`      | PR                       | `PR Integration`                            | –                                     | required                           | selektive oder vollständige Integration                                   |
| `runtime-gates.yml`      | Push `main`, Nightly     | `Integration`                               | –                                     | Main-/Nightly-Signal               | vollständige Integration ohne PR-Scope                                    |
| `main-build.yml`         | PR, Push `main`          | `App Build`                                 | –                                     | informativ                         | App-Build und Runtime-Artefaktprüfung                                     |
| `repository-hygiene.yml` | PR, Push `main`          | `Documentation Integrity`                   | –                                     | informativ                         | aktuelle lokale Dokumentationsverträge                                    |
| `repository-hygiene.yml` | PR, Push `main`          | `File Placement`                            | –                                     | required                           | Dateiplatzierung und Rollout-Dokumentation                                |
| `repository-hygiene.yml` | PR, Push `main`          | `Documentation Catalog (advisory)`          | –                                     | advisory                           | route-owned Anwenderdokumentation                                         |
| `repository-hygiene.yml` | PR, Push `main`          | `DB Schema Snapshot`                        | –                                     | informativ                         | selektive Schema-Snapshot-Parität                                         |

Im PR-Modus sind 15 Jobs ausführbar; `Integration` ist durch sein Job-`if`
ausgeschlossen. Unit und Coverage veröffentlichen je einen internen
Ausführungsjob und einen stabilen Required-Aggregator. Relevanz wird bei
mehreren anderen Jobs erst innerhalb der Steps entschieden.

## Quantitative Orchestrierungsbaseline

| Größe                                | `quality-gates.yml` | `runtime-gates.yml` | `main-build.yml` | `repository-hygiene.yml` | Summe |
| ------------------------------------ | ------------------: | ------------------: | ---------------: | -----------------------: | ----: |
| YAML-Zeilen                          |                 402 |                 403 |               80 |                      165 | 1.050 |
| Jobs                                 |                   6 |                   5 |                1 |                        4 |    16 |
| `pr-scope.cli.ts`                    |                   5 |                   3 |                1 |                        0 |     9 |
| `dorny/paths-filter`                 |                   5 |                   3 |                1 |                        2 |    11 |
| `actions/checkout`                   |                   6 |                   5 |                1 |                        4 |    16 |
| vollständiges `setup-pnpm-workspace` |                   5 |                   4 |                1 |                        4 |    14 |
| Node-only Aggregator-Setup           |                   1 |                   1 |                0 |                        0 |     2 |

Gegenüber der Plan-Baseline auf `7bacf2bbb` ist die YAML-Summe von 967 auf
1.050 Zeilen, die Zahl der `paths-filter`-Schritte von zehn auf elf und die
Zahl vollständiger Workspace-Setups von zwölf auf 14 gestiegen. Die neun
allgemeinen Scope-Auswertungen sind unverändert. Der relevante Drift erzwingt
diese neue Baseline.

## Fachliche Gate-Aufrufe im PR-Modus

Die Jobmatrix besitzt folgende fachliche Ausführungs- beziehungsweise
Aggregationspfade:

- Quality: Lint, Unit Direct, Unit Remaining, Unit-Aggregation, Types und A11y
- Runtime: Coverage-Ausführung, Coverage-Aggregation, Complexity und
  PR Integration
- Build: App Build samt Runtime-Artefaktprüfung
- Hygiene: Documentation Integrity, File Placement, Documentation Catalog und
  DB Schema Snapshot

Coverage führt zusätzlich einen App-Build als internen Step aus, während
`main-build.yml` denselben App-Build-Vertrag für denselben PR-Head ausführt.
Diese Doppelarbeit ist ein Orchestrierungsduplikat; der Build selbst bleibt ein
fachlicher Schutzvertrag.

## Schutzvertrag und Orchestrierungsduplikat

### Fachliche Schutzverträge

- Nx besitzt Projektgraph, `affected` und die Target-Konfiguration.
- `pr-scope.ts` und `changed-project-plan.ts` besitzen sicheren PR-Scope,
  Full-Fallback und Changed-first-Planung.
- `affected-unit-gate.ts`, `affected-coverage-gate.ts` und `coverage-plan.ts`
  besitzen Unit-/Coverage-Phasen und deren Vollständigkeit.
- `coverage-shard-evidence.ts` und `ci-feedback-aggregate.ts` besitzen
  versionierte, SHA-gebundene und fail-closed Ergebnisverträge.
- Root-Skripte besitzen Lint, Types, Complexity, Integration, A11y,
  File Placement, Dokumentations-, Schema- und Build-Gates.
- `build.yml`, `app-e2e.yml` und `promote.yml` besitzen die getrennte Kette aus
  Runtime-Artefakt, Main-E2E-Evidenz und geschützter Same-Digest-Promotion.

### Orchestrierungsduplikate

- neun unabhängige Aufrufe derselben allgemeinen PR-Scope-Entscheidung;
- elf YAML-basierte Pfadfilter zusätzlich zu typsicherem Scope und Fachplanern;
- 14 vollständige Installations-/Workspace-Setups für bis zu 15 PR-Jobs;
- wiederholte Checkout-, Relevanz- und Summary-Bausteine;
- App Build einmal als eigener Job und zusätzlich innerhalb von Coverage;
- gemischte PR-, Main- und Nightly-Verantwortung in denselben Dateien.

Die Konsolidierung darf ausschließlich diese zweite Gruppe reduzieren. Sie
darf keinen Vertrag der ersten Gruppe neu interpretieren oder entfernen.

## Laufzeit- und Fehlerbaseline

Die Messwerte werden aus dem abgeschlossenen Accelerate-Change übernommen,
weil dessen Report bereits 20 nicht abgebrochene grüne PR-Head-SHAs sowie eine
getrennte 20-Run-Main-E2E-Stichprobe auswertet. Eine erneute Stichprobe würde
keine zusätzliche Baseline liefern.

Quelle:
`docs/reports/pr-quality-gate-latency-baseline-2026-08.md`

| Messgröße                                       |            Vor Changed-first | Nach Aktivierung / Ausgangswert für Konsolidierung |
| ----------------------------------------------- | ---------------------------: | -------------------------------------------------: |
| Median terminale Zeit von `Unit` und `Coverage` |                      505,5 s |                                              348 s |
| P90 terminale Zeit                              |                        585 s |                                              513 s |
| direkt zuordenbarer bestätigter Unit-Fehler     | historische Fälle über 6 min |                   172 s im beobachteten roten Fall |
| vollständiges Main-E2E                          |           nicht vergleichbar |                          Median 422,5 s, P90 756 s |

Der direkte rote Nachweis umfasst in diesem Fenster nur einen zuordenbaren
Fall. Deshalb wird daraus keine statistisch belastbare rote Median-/P90-
Verteilung behauptet. Issue
[`#1155`](https://github.com/smart-village-solutions/sva-studio/issues/1155)
führt die rote Stichprobe nicht blockierend fort.

Die Coverage-Parität wurde separat über 20 aufeinanderfolgende,
nicht abgebrochene PR-Läufe nachgewiesen. Alter Abschlussjob und
Shadow-Aggregator gehörten jeweils zum selben Head-SHA und hatten identische
terminale Ergebnisse. Die historische Pro-Lauf-Aufbereitung aller Scope-Sets
bleibt als nicht blockierendes Issue
[`#1154`](https://github.com/smart-village-solutions/sva-studio/issues/1154)
offen. Quelle:
`docs/reports/pr-coverage-parity-cutover-2026-08-25.md`.

## Messbare Zielgrenzen

- exakt sieben unveränderte Required-Kontexte;
- genau eine allgemeine PR-Scope-Entscheidung pro Run;
- identische Scope- und Endergebnisse in mindestens 20 repräsentativen
  Shadow-Läufen;
- höchstens 840 produktive YAML-Zeilen als Ersatz für die heutigen vier
  Workflows, entsprechend mindestens 20 Prozent Reduktion;
- keine Nettozunahme produktiver CI-Orchestrierungs-TS-Zeilen;
- keine doppelte App-Build- oder Gate-Ausführung pro Event-/SHA-Kontext;
- höchstens 30 Sekunden Regression der medianen terminalen Zeit grüner
  Required Checks.

## Proof-Limits

Die Baseline beweist den Stand des genannten Repository-Commits und das live
gelesene Ruleset am Erhebungstag. Sie beweist noch keine Zieltopologie, keinen
Shadow-Lauf und keinen Cutover. Vor Plan 035 und erneut vor Plan 036 müssen
Workflow-Drift, aktive parallele Changes und das Ruleset aktualisiert werden.
