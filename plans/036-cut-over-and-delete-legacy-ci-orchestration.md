# Plan 036: Auf konsolidierte Gates umschalten und Alt-Orchestrierung löschen

> **Executor-Anweisung**: Nur nach vollständig grüner, dokumentierter
> Shadow-Parität aus Plan 035 ausführen. Cutover und Löschung müssen in einem
> reviewbaren Change erfolgen; kein Zwischenstand darf Required Checks fehlen
> lassen.
>
> **Drift-Check (zuerst ausführen)**:
> `git diff --stat 7bacf2bbb..HEAD -- .github/workflows .github/actions package.json nx.json scripts/ci docs/development/testing-coverage.md openspec/changes/accelerate-pr-failure-feedback openspec/changes/refactor-ci-gate-orchestration`
> Bei Drift die Shadow-Parität neu bestätigen.

## Status

- **Priorität**: P1
- **Aufwand**: M
- **Risiko**: HIGH
- **Status**: BLOCKED
- **Abhängig von**: Plan 034 und 035 vollständig; Accelerate abgeschlossen;
  menschliche Cutover-Freigabe
- **Kategorie**: tech-debt / dx
- **Reconciled auf**: Commit `7bacf2bbb`, 2026-08-24

## Warum das wichtig ist

Der Nutzen entsteht erst durch Löschung. Bleiben Shadow und Altpfad parallel
bestehen, steigt die Ownership statt zu sinken. Der Cutover muss trotzdem die
sieben live geschützten Kontexte, Main-/Nightly-Vollständigkeit und den
kanonischen Releasepfad ohne Unterbrechung erhalten.

## Invarianten

- Required-Kontexte bleiben exakt: `Lint`, `Unit`, `Types`, `Complexity`,
  `PR Integration`, `File Placement`, `Coverage`.
- Die von Accelerate eingeführten Unit-/Coverage-Phasen, Head-SHA-gebundenen
  Evidenzformate und fail-closed Aggregatoren bleiben fachlich unverändert.
- `build.yml -> promote dev`, kanonisches Main-E2E, Staging-Preflight und
  Same-Digest-Production bleiben unverändert.
- Kein Test-, Coverage-, Complexity-, Runtime-, Security-, A11y- oder
  Datenintegritätsvertrag wird entfernt; nur seine Orchestrierung wird
  konsolidiert.
- `nx.json` behält `neverConnectToCloud: true`; Integration, E2E und Coverage
  ohne Determinismusnachweis bleiben ungecacht.

## Befehle

| Zweck           | Befehl                                                                | Erfolg           |
| --------------- | --------------------------------------------------------------------- | ---------------- |
| Tooling-Unit    | `pnpm nx run tooling-testing:test:unit`                               | alle Tests grün  |
| Script-Typen    | `pnpm exec tsc -p tsconfig.scripts.json --noEmit`                     | Exit 0           |
| Tooling-Lint    | `pnpm nx run tooling-testing:lint`                                    | Exit 0           |
| Lokales PR-Gate | `pnpm test:pr`                                                        | Exit 0, ohne E2E |
| OpenSpec        | `pnpm exec openspec validate refactor-ci-gate-orchestration --strict` | Exit 0           |
| Placement       | `pnpm check:file-placement`                                           | Exit 0           |
| Diff            | `git diff --check`                                                    | keine Ausgabe    |

## Scope

**In Scope:** ausschließlich die im genehmigten OpenSpec und im
Plan-035-Paritätsreport benannten PR-/Main-Gate-Workflows, ihre Contract-Tests,
nachweislich obsolete Workflow-Orchestrierungshelper, Root-Skripte und
betroffene CI-/arc42-Dokumentation.

**Außerhalb:** Accelerate-Scope-/Phasenplaner und Evidenzvalidatoren mit
verbleibenden produktiven Callern; Produktcode; `build.yml`, `promote.yml`,
`app-e2e.yml`, CodeQL, Monitoring, Schema-Diff, Backup, Restore, Cutover- und
Spezialrelease-Workflows; Änderungen an fachlichen Testfloors; neue
Remote-Caches.

## Git-Workflow

- Branch: `chore/ci-gate-orchestration-cutover`
- Commits: `refactor(ci): cut over consolidated gates`, danach
  `chore(ci): remove legacy orchestration` nur wenn beide Commits zusammen im
  PR bleiben und jeder final validierte Head alle Kontexte erzeugt.
- Kein Push/PR ohne Operatoranweisung; Ruleset-Mutation benötigt separate
  ausdrückliche Autorisierung, falls entgegen der Planung Namen geändert werden.

## Schritte

### 1. Cutover-Voraussetzungen einfrieren

Paritätsreport, genehmigtes OpenSpec, aktuelle Workflow-Hashes und Live-Ruleset
erfassen. Prüfen, dass keine in-scope Workflowänderung seit der Shadow-Abnahme
eingegangen ist.

**Verifizieren**: Live-Ruleset enthält weiterhin exakt die sieben Invarianten;
alle Shadow-Paritätsfälle stehen auf `pass`.

### 2. Atomar auf stabile Jobnamen umschalten

Neue Topologie-Jobs von Shadow-Namen auf die exakten Required-Kontexte
umstellen und gleichzeitig die alten PR-Trigger/Jobs deaktivieren. Die
innerhalb von Accelerate bereits stabilisierten Aggregatornamen werden dabei
nicht erneut migriert. Der erste Push des Cutover-PR muss alle sieben Kontexte
terminal erzeugen; Docs-only-No-op und Full-Fallback sind besonders zu prüfen.
Main-/Nightly-Volljobs auf die im Proposal definierte konsolidierte Topologie
umschalten.

**Verifizieren**: Workflow-Contract-Tests bestätigen jeden Required-Namen genau
einmal, korrekten Event-Scope und alle `needs`-Kanten.

### 3. Obsolete Orchestrierung löschen

Erst nach dem erfolgreichen Cutover entfernen:

- abgelöste Workflowdateien beziehungsweise deren leere Altjobs;
- doppelte `dorny/paths-filter`-Matrizen und wiederholte allgemeine
  `pr-scope.cli.ts`-Aufrufe;
- ausschließlich für Shadow-Vergleich verwendete Jobs/Artefakte;
- TS-Helper, Exporte und Tests, deren einziger Caller ein gelöschter Altpfad
  war; Accelerate-Planer, Evidenzvalidatoren und Aggregatoren nur dann, wenn
  nachweislich kein produktiver Caller und kein fachlicher Vertrag verbleibt.

Vor jeder Script-Löschung mit `rg` und Fallow/Knip die verbleibenden Caller
prüfen. Öffentliche Package- oder Operatorverträge nicht auf statischen Befund
hin löschen.

**Verifizieren**:
`pnpm knip:scan` sowie `pnpm exec fallow dead-code --boundary-violations --quiet` → keine neu eingeführte Regression; bekannte Bestandsbefunde dokumentieren.

### 4. Löschbilanz und Laufzeit nachweisen

Gegen die Plan-034-Baseline auswerten:

- mindestens 20 % weniger YAML-Zeilen im abgelösten Orchestrierungsscope;
- keine Nettozunahme produktiver CI-Orchestrierungs-TS-Zeilen;
- allgemeine PR-Scope-Auswertung genau einmal;
- kein Gate/App-Build doppelt für denselben Event-/SHA-Kontext;
- grüne Medianzeit höchstens 30 Sekunden schlechter;
- gleiche oder bessere Zeit bis zum ersten verwertbaren Fehler.

Wird ein Ziel verfehlt, nicht durch das Entfernen von Schutzverträgen retten.

### 5. Dokumentation und OpenSpec abschließen

`docs/development/testing-coverage.md`, relevante arc42-Abschnitte und
OpenSpec-Tasks auf die tatsächliche Endtopologie reduzieren. Alte Workflownamen
und inzwischen falsche PR-E2E-Aussagen entfernen. Den Change erst nach finalem
GitHub-HEAD-Nachweis als vollständig markieren.

**Verifizieren**:
`pnpm exec openspec validate refactor-ci-gate-orchestration --strict && pnpm check:file-placement && git diff --check` → grün.

### 6. Exakten PR-HEAD live abnehmen

Auf dem finalen Push müssen alle sieben Required Checks terminal erfolgreich,
kein erwarteter Kontext ausstehend und kein Workflow doppelt sein. Zusätzlich
informative A11y-/Build-/DB-Snapshot-Signale gemäß Scope prüfen. Erst danach ist
die Konsolidierung merge-bereit; dieser Plan autorisiert keinen Merge.

## Done-Kriterien

- [ ] Jeder Required-Kontext erscheint genau einmal und ist SHA-genau terminal.
- [ ] Scope-, No-op-, affected- und Full-Fallback-Contract-Tests sind grün.
- [ ] Main-/Nightly-Vollständigkeit bleibt erhalten.
- [ ] Release-, Security-, Monitoring-, Schema-, Backup-/Restore-Pfade sind unverändert.
- [ ] YAML im Zielscope sank um mindestens 20 %, CI-TS wuchs netto nicht.
- [ ] Keine doppelte allgemeine Scope-Auswertung oder Gate-Ausführung bleibt.
- [ ] Tooling-Unit, Types, Lint, `test:pr`, OpenSpec, Placement und Diff sind grün.
- [ ] OpenSpec-Tasks spiegeln den tatsächlich nachgewiesenen Stand.

## STOP-Bedingungen

- Einer der sieben Kontexte fehlt, bleibt `expected`, ist doppelt oder gehört
  nicht zum exakten Head-SHA.
- Ein Accelerate-Resttask ist wieder offen oder die aktuelle
  Unit-/Coverage-Parität ist nicht mehr belegt.
- Der Cutover würde eine Ruleset-Änderung erfordern, die nicht ausdrücklich
  autorisiert wurde.
- Parität muss durch reduzierte Tests, Floors, Fail-closed-Regeln oder
  Deployment-Nachweise erkauft werden.
- Ein vermeintlich obsoleter Helper besitzt noch einen produktiven Caller.
- Build, Main-E2E oder Promote ändern sich unerwartet im Diff.

## Wartungshinweise

Nach dem Cutover soll jede neue allgemeine Gate-Policy zuerst in einem
bestehenden Nx-/Root-Vertrag landen. Ein zusätzlicher Workflow oder CI-Wrapper
braucht künftig die belegte Antwort, welchen vorhandenen Pfad er ersetzt oder
warum ein eigener Event-/Berechtigungs-/Runtime-Kontext zwingend ist.
