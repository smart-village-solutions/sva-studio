# Plan 035: Konsolidierte PR- und Main-Gates im Shadow-Modus beweisen

> **Executor-Anweisung**: Nur nach freigegebenem OpenSpec
> `refactor-ci-gate-orchestration` ausführen. Die bestehenden Required-Workflows
> und Ruleset-Kontexte in diesem Plan noch nicht entfernen oder umbenennen.
>
> **Drift-Check (zuerst ausführen)**:
> `git diff --stat 6b1ae3ae..HEAD -- .github/workflows .github/actions package.json nx.json scripts/ci openspec/changes/refactor-ci-gate-orchestration docs/reports/ci-gate-ownership-baseline-2026-08.md docs/development/testing-coverage.md`
> Bei relevantem Drift die freigegebene Baseline aktualisieren oder STOP.

## Status

- **Priorität**: P1
- **Aufwand**: L
- **Risiko**: MED
- **Status**: TODO
- **Abhängig von**: erfüllt; Plan 034 abgeschlossen, OpenSpec genehmigt und
  Accelerate archiviert
- **Kategorie**: tech-debt / dx
- **Reconciled auf**: Commit `82308a492`, 2026-08-28

## Warum das wichtig ist

Die neue Topologie muss vor dem Cutover beweisen, dass sie denselben Scope und
dieselben Endentscheidungen liefert. Ein direktes Umschalten wäre riskant,
weil Required Checks bei fehlenden Jobs dauerhaft `expected` bleiben oder ein
Scope-Fehler Tests auslassen könnte. Der Shadow-Modus erzeugt deshalb
maschinenlesbare Parität, ohne Merge-Schutz oder Deployment zu beeinflussen.

## Aktueller Vertrag

- Führende Scope-Logik: `scripts/ci/pr-scope.ts` und die Nx-basierten Planer
  `changed-project-plan.ts`, `affected-unit-plan.ts` und `coverage-plan.ts`.
- Unit verwendet bereits direkte und verbleibende Phasen mit einem required
  `Unit`-Aggregator. Coverage verwendet den internen Job `Coverage Complete`
  und den stabilen required Aggregator `Coverage`; der Topologie-Shadow darf
  diese fachlichen Phasen oder Aggregatoren nicht duplizieren.
- `ci-feedback-aggregate.ts`, `coverage-shard-evidence.ts` und
  `validate-downloaded-coverage.ts` sind vorhandene Evidenzverträge. Der
  Topologie-Shadow darf keinen parallelen Unit-/Coverage-Aggregator einführen.
- Lokaler Gesamteinstieg: `package.json`-Script `test:pr` über
  `scripts/ci/run-pr-gate.ts`.
- Required-Kontexte: `Lint`, `Unit`, `Types`, `Complexity`, `PR Integration`,
  `File Placement`, `Coverage`.
- A11y, App Build und DB Schema Snapshot bleiben eigenständige Signaltypen,
  sind derzeit aber keine live Required-Kontexte.
- `build.yml`, `app-e2e.yml` und `promote.yml` bilden den geschützten
  Releasepfad und bleiben unverändert.

## Befehle

| Zweck         | Befehl                                                                                                                                                                                                                                                                                 | Erfolg          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Tooling-Tests | `pnpm nx run tooling-testing:test:unit --testFiles=scripts/ci/pr-scope.test.ts --testFiles=scripts/ci/run-pr-gate.test.ts --testFiles=scripts/ci/changed-project-plan.test.ts --testFiles=scripts/ci/affected-unit-gate.test.ts --testFiles=scripts/ci/affected-coverage-gate.test.ts` | alle Tests grün |
| Script-Typen  | `pnpm exec tsc -p tsconfig.scripts.json --noEmit`                                                                                                                                                                                                                                      | Exit 0          |
| Tooling-Lint  | `pnpm nx run tooling-testing:lint`                                                                                                                                                                                                                                                     | Exit 0          |
| OpenSpec      | `pnpm exec openspec validate refactor-ci-gate-orchestration --strict`                                                                                                                                                                                                                  | Exit 0          |
| Placement     | `pnpm check:file-placement`                                                                                                                                                                                                                                                            | Exit 0          |

## Scope

**In Scope:** die im genehmigten Proposal exakt benannten neuen
Topologie-Shadow-Workflows beziehungsweise wiederverwendbaren Workflow-Aufrufe,
erforderliche Workflow-Contract-Tests, OpenSpec-Tasks und betroffene
CI-/arc42-Dokumentation.

**Außerhalb:** GitHub-Ruleset-Mutationen; Löschung oder Trigger-Entfernung der
alten Required-Workflows; neue Unit-/Coverage-Planer, Shard-Evidenz oder
Aggregatoren; Produktcode; Nx Cloud; Build/Promote/Main-E2E; Security-,
Monitoring-, Schema-Diff-, Backup-, Restore- und Release-Spezialpfade.

## Git-Workflow

- Branch: `chore/ci-gate-orchestration-shadow`
- Commitblöcke: `test(ci): characterize gate topology`,
  `refactor(ci): add consolidated gate shadow`, `docs(ci): record shadow parity`
- Nicht pushen oder PR eröffnen, sofern der Operator das nicht anweist.

## Schritte

### 1. Bestehendes Verhalten charakterisieren

Contract-Tests müssen für alle relevanten Workflowdateien Trigger, Jobnamen,
No-op-Verhalten, Base-/Head-Bindung, Cache-Grenzen und Gate-Kommandos auswerten.
Mindestens diese PR-Klassen abdecken: Docs-only, einzelnes Package, App-UI,
Server-Runtime, Migration/DB-Schema, CI-Tooling und globales Lockfile/Nx-Config.

**Verifizieren**: fokussierter `tooling-testing:test:unit`-Befehl aus der Tabelle → grün.

### 2. Den kanonischen Scope-Output wiederverwenden

Den nach Accelerate-Abschluss vorhandenen `PrScopeDecision` einmal erzeugen und
unverändert an alle Shadow-Jobs übergeben. Nur wenn das genehmigte Spec einen
nachweislich fehlenden Modus für DB-Snapshot oder informative
App-Build-Signale benennt, darf der bestehenden Entscheidung ein kleiner,
getesteter Modus hinzugefügt werden. Keine zweite Pfadmatrix in YAML anlegen.
Schema-Version, Base-SHA, Head-SHA, normalisierte Dateiliste, Gate-Modi und
Fallback-Gründe bleiben maschinenlesbar; unbekannter Scope fällt auf `full`.

**Verifizieren**:
`pnpm nx run tooling-testing:test:unit --testFiles=scripts/ci/pr-scope.test.ts` → grün.

### 3. Konsolidierte Shadow-Topologie ergänzen

Gemäß genehmigtem Design:

- ein PR-Shadow-Workflow berechnet den allgemeinen Scope genau einmal und führt
  Shadow-Jobs mit ausdrücklich nicht-required Namen aus;
- ein Main-/Nightly-Shadow-Workflow bildet die vollständigen
  nicht-deploymentbezogenen Gates ab;
- jeder Shadow-Job verwendet dieselben Root-/Nx-Kommandos und vorhandenen
  Unit-/Coverage-Evidenzverträge wie der bestehende Schutzpfad, statt Gate-
  Policy oder Aggregation in YAML beziehungsweise TypeScript zu kopieren;
- alle Ergebnisse tragen dasselbe Head-SHA und eine Version des Scope-Plans;
- Docs-only-No-op-Jobs enden terminal erfolgreich und bleiben sichtbar;
- kein Shadow-Job darf deployen, mutieren oder ein Required-Ergebnis ersetzen.

**Verifizieren**: neue Workflow-Contract-Tests plus YAML-Parse → grün.

### 4. Paritätsaggregator implementieren

Der Topologievergleich liest pro Gate die bereits vorhandenen terminalen
Ergebnisse und Evidenzartefakte und vergleicht alten und neuen Scope sowie das
Endergebnis. Er ersetzt oder dupliziert weder den required `Unit`- noch den
nach Accelerate-Abschluss required `Coverage`-Aggregator. Fehlende, doppelte,
veraltete, fremd-SHA-gebundene oder nicht auswertbare Ergebnisse sind
`mismatch`, niemals implizit `pass`. Geheimnisse, Environment-Dumps und
Testinhalte dürfen nicht in Evidenzartefakte gelangen.

**Verifizieren**: Tests für Pass sowie jede negative Evidenzklasse → grün.

### 5. Shadow-Messung durchführen

Mindestens 20 repräsentative PR-Läufe auswerten. Dokumentieren:

- Scope-/Endergebnis-Parität je Gate;
- Setup-, Queue-, Ausführungs- und Aggregationszeit;
- Zeit bis zum ersten verwertbaren Fehler;
- Runner-Minuten und doppelte Arbeit des temporären Shadows;
- geplante Löschbilanz für Plan 036.

Bei einer einzigen ungeklärten Unterabdeckung kein Cutover empfehlen.

**Verifizieren**: Paritätsreport enthält 20 auswertbare Läufe und null
ungeklärte Scope-/Endergebnisabweichungen.

### 6. OpenSpec und Doku fortschreiben

Nur nach nachgewiesener Parität die Shadow-Tasks abhaken und den konkreten
atomaren Cutover für Plan 036 dokumentieren. Arc42 04/08/10/11 und
`docs/development/testing-coverage.md` auf die noch nicht blockierende
Shadow-Phase aktualisieren.

**Verifizieren**:
`pnpm exec openspec validate refactor-ci-gate-orchestration --strict && pnpm check:file-placement && git diff --check` → grün.

## Done-Kriterien

- [ ] Scope wird im neuen PR-Pfad genau einmal allgemein klassifiziert.
- [ ] Shadow-Jobs sind nicht required und verändern keine bestehende Gate-Entscheidung.
- [ ] Sieben Required-Verträge plus A11y/App-Build/DB-Snapshot sind charakterisiert.
- [ ] Mindestens 20 Läufe zeigen null ungeklärte Unterabdeckung oder Ergebnisdrift.
- [ ] Script-Typen, Tooling-Unit, Tooling-Lint, OpenSpec und Placement sind grün.
- [ ] Keine alte Workflowdatei, kein Ruleset und kein Releasepfad wurde entfernt/geändert.

## STOP-Bedingungen

- Das Live-Ruleset oder der aktuelle Workflowstand widerspricht der
  freigegebenen Baseline beziehungsweise dem OpenSpec.
- Ein Required-Check lässt sich nicht head-SHA-genau und fail-closed abbilden.
- Shadow und Bestand unterscheiden sich in Scope oder Ergebnis ohne belegten
  Fehler im Altpfad.
- Die Lösung benötigt einen neuen allgemeinen CI-Framework-Layer statt
  vorhandener Nx-/Root-Verträge.
- Median der grünen terminalen Zeit würde nach dem Cutover voraussichtlich um
  mehr als 30 Sekunden steigen.

## Wartungshinweise

Shadow-Code ist temporärer Migrationscode. Plan 036 muss ihn zusammen mit den
Altpfaden löschen; ein dauerhaftes doppeltes CI-System ist kein akzeptabler
Endzustand.
