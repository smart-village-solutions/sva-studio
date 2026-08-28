# Change: CI-Gate-Orchestrierung konsolidieren

## Why

Die fachlichen CI-Verträge sind belastbar, werden für Pull Requests aber über
vier allgemeine Workflows mit wiederholter Scope-, Relevanz- und
Workspace-Ermittlung orchestriert. Diese Doppelownership erhöht Laufzeit und
Änderungsrisiko, obwohl Nx, Root-Skripte und die bestehenden fail-closed
Aggregatoren bereits die fachlichen Entscheidungen besitzen.

Die Konsolidierung muss deshalb die sieben live geschützten Checknamen, den
vollständigen Scope und den geschützten Rollout unverändert erhalten. Sie ist
eine Orchestrierungsänderung und keine Gelegenheit, Gates oder
Evidenzgrenzen abzuschwächen.

## What Changes

- Ein PR-Gate-Workflow ermittelt den allgemeinen PR-Scope genau einmal und
  bindet ihn an Base- und Head-SHA. Alle PR-Gates konsumieren diese Evidenz.
- Die Required-Kontexte bleiben exakt `Lint`, `Unit`, `Types`, `Complexity`,
  `PR Integration`, `File Placement` und `Coverage`.
- Ein getrennter Main-/Nightly-Verifikationsworkflow führt die vollständigen
  nicht deploymentbezogenen Prüfungen aus. Der kanonische Build bleibt allein
  für Runtime-Artefakt und Image zuständig.
- Bestehende Root-/Nx-Skripte, Changed-first-Planer, Unit-/Coverage-Phasen,
  Evidenzvalidatoren und Aggregatoren bleiben die fachliche Source of Truth;
  Workflow-YAML implementiert keine zweite Pfad- oder Gate-Policy.
- Die Migration erfolgt über nicht blockierende Topologie-Parität, danach
  atomaren Cutover und erst anschließend Löschung der Alt-Orchestrierung.
- Die vier abgelösten Orchestrierungsworkflows werden von aktuell 1.050 auf
  höchstens 840 produktive YAML-Zeilen reduziert. Produktive
  CI-Orchestrierungs-TS-Zeilen dürfen nach dem Cutover netto nicht steigen.
- Derselbe App-Build- oder Gate-Vertrag darf für denselben Event-/SHA-Kontext
  nicht doppelt ausgeführt werden. Die mediane terminale Zeit grüner Required
  Checks darf gegenüber der bestehenden Baseline um höchstens 30 Sekunden
  steigen.

## Unveränderte Grenzen

- `build.yml`, `app-e2e.yml`, `promote.yml`, CodeQL, Schema-Diff, Monitoring,
  Backup, Restore, Cutover und produktspezifische Release-Workflows bleiben
  eigenständig und fachlich unverändert.
- Es gibt keine GitHub-Ruleset-Mutation, keinen zweiten Unit-/Coverage-Shadow,
  keinen selbst gebauten runnerübergreifenden Nx-Cache und keine neue
  universelle CI-Engine.
- Coverage-, Complexity-, Node-ESM-Runtime-, Security-, A11y-,
  Datenintegritäts- und Rollout-Grenzen bleiben mindestens gleich streng.
- Die offenen Issues `#1154` und `#1155` verbessern historische
  Scope-Aufbereitung beziehungsweise die rote Latenzstichprobe, übertragen
  aber keine fachliche Ownership auf diesen Change und blockieren die bereits
  akzeptierte Accelerate-Baseline nicht.

## Impact

- Betroffene Specs: `monorepo-structure`, `test-coverage-governance`
- Betroffene Implementierung in Plan 035/036:
  `.github/workflows/quality-gates.yml`,
  `.github/workflows/runtime-gates.yml`, `.github/workflows/main-build.yml`,
  `.github/workflows/repository-hygiene.yml`, deren konsolidierte Nachfolger
  sowie eng begrenzte Workflow-Contract-Tests
- Wiederverwendete Verträge: `scripts/ci/pr-scope.ts`,
  `changed-project-plan.ts`, `affected-unit-gate.ts`,
  `affected-coverage-gate.ts`, `coverage-plan.ts`,
  `coverage-shard-evidence.ts` und `ci-feedback-aggregate.ts`
- Architekturfortschreibung in Plan 035/036:
  `04-solution-strategy.md` für die Zieltopologie,
  `07-deployment-view.md` für die Trennung von Verifikation und Release,
  `08-cross-cutting-concepts.md` für Scope-/Evidenzownership,
  `10-quality-requirements.md` für Paritäts- und Laufzeitziele sowie
  `11-risks-and-technical-debt.md` für Cutover- und Restschuld-Risiken
- Baseline: `docs/reports/ci-gate-ownership-baseline-2026-08.md`

## Freigabegrenze

Dieses Proposal autorisiert noch keine produktive Workflow-, Script- oder
Ruleset-Änderung. Plan 035 beginnt erst nach ausdrücklicher menschlicher
Freigabe dieses OpenSpec-Changes.
