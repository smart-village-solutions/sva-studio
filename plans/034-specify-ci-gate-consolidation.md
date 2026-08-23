# Plan 034: CI-Gate-Konsolidierung als messbaren OpenSpec-Vertrag festlegen

> **Executor-Anweisung**: Dies ist ein reiner Analyse- und Proposal-Plan. Keine
> produktive Workflow-, Script-, Ruleset- oder Deployment-Änderung durchführen.
> Jeden Prüfschritt ausführen. Bei einer STOP-Bedingung nicht improvisieren.
>
> **Drift-Check (zuerst ausführen)**:
> `git diff --stat 7bacf2bbb..HEAD -- .github/workflows package.json nx.json scripts/ci openspec/changes/accelerate-pr-failure-feedback docs/development/testing-coverage.md`
> Bei Drift die Baseline neu erheben und alle Zahlen im Proposal aktualisieren.

## Status

- **Priorität**: P1
- **Aufwand**: M
- **Risiko**: LOW
- **Status**: BLOCKED
- **Abhängig von**: die offenen Accelerate-Tasks 0.5, 7.1, 7.4, 8.4 und 8.5 müssen fachlich abgeschlossen sein
- **Kategorie**: tech-debt / dx
- **Reconciled auf**: Commit `7bacf2bbb`, 2026-08-24

## Warum das wichtig ist

Die fachlichen Schutzverträge der CI sind überwiegend sinnvoll, ihre
Orchestrierung ist jedoch auf mehrere PR-/Main-Workflows und wiederholte
Scope-Auswertung verteilt. Eine Konsolidierung ohne vorherigen Vertrag könnte
Required Checks, affected-Vollständigkeit oder den geschützten Rollout
versehentlich abschwächen. Dieser Plan erzeugt deshalb zuerst eine aktuelle,
messbare Baseline und ein genehmigungsfähiges OpenSpec; die Umsetzung beginnt
erst in Plan 035.

## Aktueller Stand

- Das am 24. August 2026 live gelesene GitHub-Ruleset `11600196` verlangt exakt
  die Kontexte `Lint`, `Unit`, `Types`, `Complexity`, `PR Integration`,
  `File Placement` und `Coverage`. Diese Namen sind ein unveränderlicher
  Migrationsvertrag.
- PR #1130 hat `accelerate-pr-failure-feedback` nach `main` gemergt. Der Change
  bleibt mit 40/45 Tasks aktiv: offen sind 0.5, 7.1, 7.4, 8.4 und 8.5.
- `.github/workflows/quality-gates.yml` besitzt Lint, Unit Fast Feedback,
  Unit Complete, den required Unit-Aggregator, Types und A11y. Die fünf
  ausführenden Jobs wiederholen derzeit jeweils Relevanz-, Workspace- und
  `pr-scope.cli.ts`-Setup. Unit-Planung, Evidenz und Aggregation gehören bereits
  dem Accelerate-Change und sind keine neue Konsolidierungslogik.
- `.github/workflows/runtime-gates.yml` besitzt Coverage, den noch
  nicht-required Job `Coverage Shadow`, Complexity, PR Integration und den
  Main-/Nightly-Job Integration. Die Coverage-Shadow-Parität und der spätere
  stabile Aggregatorname sind noch Accelerate-Task 7.4; drei weitere Jobs
  bestimmen den allgemeinen PR-Scope erneut.
- `.github/workflows/main-build.yml` führt den App-Build für PR und `main` aus,
  obwohl `.github/workflows/build.yml` auf `main` bereits den kanonischen
  Runtime-Artefakt-/Image-Vertrag besitzt.
- `.github/workflows/repository-hygiene.yml` enthält den required Kontext
  `File Placement` sowie den selektiven DB-Schema-Snapshot.
- Die vier allgemeinen Orchestrierungsworkflows `quality-gates.yml`,
  `runtime-gates.yml`, `main-build.yml` und `repository-hygiene.yml` umfassen
  zusammen 967 Zeilen. Sie enthalten neun Aufrufe von `pr-scope.cli.ts`, zehn
  `dorny/paths-filter`-Schritte und zwölf Workspace-Setups.
- `scripts/ci/pr-scope.ts`, `changed-project-plan.ts`,
  `affected-unit-gate.ts`, `affected-coverage-gate.ts`, `coverage-plan.ts`,
  `coverage-shard-evidence.ts` und `ci-feedback-aggregate.ts` bilden bereits
  den typsicheren Scope-, Phasen- und Evidenzvertrag. Sie bleiben führend und
  dürfen nicht durch YAML-Patterns oder einen zweiten Aggregator dupliziert
  werden.
- `openspec/changes/accelerate-pr-failure-feedback/design.md:26-35` schließt
  eine vollständige Workflow-Neuordnung ausdrücklich aus. Die Konsolidierung
  ist daher ein eigener Folgechange und darf dessen noch offene Paritäts-,
  Aggregator- oder Messaufgaben nicht übernehmen oder verdecken.
- Der kanonische Rollout bleibt `Build -> Dev -> Staging -> Production` mit
  demselben Digest. `build.yml`, `promote.yml`, `app-e2e.yml` und operative
  Restore-/Backup-Workflows sind keine Löschkandidaten dieses Changes.

## Benötigte Befehle

| Zweck            | Befehl                                                                | Erfolg                       |
| ---------------- | --------------------------------------------------------------------- | ---------------------------- |
| Aktive Changes   | `pnpm exec openspec list`                                             | Change-Liste wird ausgegeben |
| Spezifikationen  | `pnpm exec openspec list --specs`                                     | Specs werden ausgegeben      |
| Nx-Konfiguration | `pnpm nx show project tooling-testing --json`                         | Exit 0, Targets sichtbar     |
| Proposal prüfen  | `pnpm exec openspec validate refactor-ci-gate-orchestration --strict` | Exit 0                       |
| Dateiplatzierung | `pnpm check:file-placement`                                           | Exit 0                       |
| Diff-Hygiene     | `git diff --check`                                                    | keine Ausgabe, Exit 0        |

## Scope

**In Scope:**

- `openspec/changes/refactor-ci-gate-orchestration/proposal.md` (neu)
- `openspec/changes/refactor-ci-gate-orchestration/design.md` (neu)
- `openspec/changes/refactor-ci-gate-orchestration/tasks.md` (neu)
- Delta-Specs für `monorepo-structure` und `test-coverage-governance`
- `docs/reports/ci-gate-ownership-baseline-2026-08.md` (neu)

**Explizit außerhalb des Scope:**

- alle produktiven Dateien unter `.github/workflows/`, `.github/actions/` und `scripts/ci/`
- GitHub-Ruleset-Mutationen
- `build.yml`, `promote.yml`, `app-e2e.yml`, CodeQL, Schema-Diff,
  Monitoring, Backup, Restore, Cutover und produktspezifische Release-Workflows
- Nx Cloud oder ein selbst gebauter runnerübergreifender `.nx/cache`

## Git-Workflow

- Branch: `docs/refactor-ci-gate-orchestration`
- Commit: `docs(openspec): plan ci gate consolidation`
- Nicht pushen und keinen PR öffnen, sofern der Operator das nicht anweist.

## Schritte

### 1. Accelerate-Change als Voraussetzung auflösen

`proposal.md`, `design.md`, `tasks.md`, aktuellen Git-Diff und Live-Status von
`accelerate-pr-failure-feedback` vergleichen. Plan 034 bleibt blockiert, bis
die Tasks 0.5, 7.1, 7.4, 8.4 und 8.5 vollständig nachgewiesen sind. Danach den
finalen Accelerate-Vertrag als unveränderte Eingangsgrenze dokumentieren:
Scope-Planer, Unit-/Coverage-Phasen, Evidenzvalidatoren, Aggregatoren und
Messdaten werden wiederverwendet, nicht neu implementiert.

**Verifizieren**:
`pnpm exec openspec validate accelerate-pr-failure-feedback --strict` → Exit 0.

### 2. Aktuelle Ownership- und Kostenbaseline schreiben

Im Baseline-Report mindestens erfassen:

- Trigger, Jobs, `needs`, Required-/informative Einordnung und Zweck jedes
  relevanten Workflows;
- die sieben live aus dem Ruleset gelesenen Required-Kontexte;
- Zahl der Scope-Auswertungen, `paths-filter`-Schritte,
  Checkout-/Workspace-Setups und Gate-Aufrufe pro PR-Modus; Ausgangswert auf
  Commit `7bacf2bbb` sind neun allgemeine Scope-Auswertungen, zehn
  `paths-filter`-Schritte und zwölf Workspace-Setups;
- LOC der vier heutigen Orchestrierungsworkflows; Ausgangswert sind 967 Zeilen;
- Median/P90 der Gesamtdauer sowie Zeit bis zum ersten verwertbaren Fehler aus
  mindestens 20 repräsentativen PR-Läufen, sofern diese Daten nicht bereits
  belastbar im Accelerate-Change vorliegen;
- Zuordnung `fachlicher Schutzvertrag` versus `Orchestrierungsduplikat`.

Keine Secret-Werte, Environment-Dumps oder personenbezogenen Daten aufnehmen.

**Verifizieren**:
`pnpm exec prettier --check docs/reports/ci-gate-ownership-baseline-2026-08.md` → Exit 0.

### 3. OpenSpec `refactor-ci-gate-orchestration` erstellen

Das Proposal muss folgende Zieltopologie festschreiben:

1. ein PR-Gate-Workflow mit einmaliger, SHA-gebundener allgemeiner
   Scope-Entscheidung und den stabilen sieben Required-Jobs;
2. ein getrennter Main-/Nightly-Verifikationsworkflow für vollständige
   nicht-deploymentbezogene Gates;
3. unveränderte eigenständige Build-, Main-E2E-, Promote-, Security-,
   Monitoring-, Schema-Diff-, Backup-, Restore- und Spezialrelease-Workflows;
4. Root-/Nx-Skripte bleiben fachliche Gate-Verträge; YAML enthält keine zweite
   Pfad- oder Policy-Implementierung;
5. Migration erst Topologie-Shadow/Parität, dann atomarer Cutover, danach
   Löschung; bestehende Unit-/Coverage-Shadows werden nicht dupliziert;
6. keine Abschwächung von Fail-closed-, Coverage-, ESM-Runtime-, Security-,
   A11y- oder Rollout-Grenzen.

Messbare Ziele im Spec:

- Required-Kontexte bleiben exakt gleich;
- genau eine allgemeine PR-Scope-Entscheidung pro Run;
- keine doppelte Ausführung desselben App-Build-/Gate-Vertrags für denselben
  Event-/SHA-Kontext;
- mindestens 20 % weniger YAML-Zeilen in den vier abgelösten
  Orchestrierungsworkflows zusammen;
- nach Cutover keine Nettozunahme produktiver CI-Orchestrierungs-TS-Zeilen;
- identische Scope- und Endergebnisse in einer repräsentativen Paritätsmatrix;
- grüne PR-Laufzeit verschlechtert sich im Median um höchstens 30 Sekunden.

**Verifizieren**:
`pnpm exec openspec validate refactor-ci-gate-orchestration --strict` → Exit 0.

### 4. Review- und Freigabepunkt vorbereiten

Proposal gegen `docs/architecture/04-solution-strategy.md`,
`07-deployment-view.md`, `08-cross-cutting-concepts.md`,
`10-quality-requirements.md` und `11-risks-and-technical-debt.md` prüfen. Im
Proposal benennen, welche Abschnitte Plan 035/036 aktualisieren müssen.

**Verifizieren**:
`pnpm check:file-placement && git diff --check` → beide Exit 0.

Danach STOP: Plan 035 darf erst nach ausdrücklicher Proposal-Freigabe starten.

## Testplan

- OpenSpec-Szenarien für Docs-only-No-op, normalen affected PR, globalen
  Full-Fallback, fehlgeschlagenes Required Gate, Main-Full-Run und
  unveränderten Release-Pfad.
- Negative Szenarien für fehlenden/veralteten Scope, falsches Head-SHA,
  fehlenden Required-Job und versehentliche PR-Cache-Übernahme nach `main`.
- Kein Source-Test in diesem reinen Proposal-Plan.

## Done-Kriterien

- [ ] Baseline enthält aktuelle Live-Ruleset-Kontexte und Workflow-Matrix.
- [ ] Accelerate ist mit den Tasks 0.5, 7.1, 7.4, 8.4 und 8.5 fachlich
      abgeschlossen und sein Scope ohne Doppelownership abgegrenzt.
- [ ] OpenSpec definiert Zieltopologie, Migration, Löschbilanz und STOP-Grenzen.
- [ ] `pnpm exec openspec validate refactor-ci-gate-orchestration --strict` ist grün.
- [ ] `pnpm check:file-placement` und `git diff --check` sind grün.
- [ ] Keine produktive CI-Datei und kein GitHub-Ruleset wurde verändert.
- [ ] Proposal wurde menschlich freigegeben, bevor Plan 035 startet.

## STOP-Bedingungen

- Einer der Accelerate-Tasks 0.5, 7.1, 7.4, 8.4 oder 8.5 ist offen oder seine
  Abschluss-Evidenz widerspricht dem aktuellen Git-Stand.
- Das Live-Ruleset enthält andere Required-Kontexte als oben genannt.
- Die Zieltopologie erfordert eine Abschwächung eines bestehenden Gates.
- Die Konsolidierung greift in Build/Promote/Main-E2E oder operative
  Recovery-Workflows ein.

## Wartungshinweise

Das Proposal soll keine neue universelle CI-Engine spezifizieren. Der
gemeinsame Vertrag endet bei Scope, Gate-Modus und Ergebnis; Nx bleibt für
Projektgraph und affected zuständig, GitHub Actions für Job-Orchestrierung.
