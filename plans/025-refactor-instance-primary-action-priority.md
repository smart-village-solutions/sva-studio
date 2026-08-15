# Plan 025: Primäraktion der Instance-Operationsmodelle explizit priorisieren

> **Executor-Anweisung:** Dieser Plan ist ein eigenes Zielproblem in Bundle B. Seine Prioritätsmatrix muss vor jeder Source-Änderung gegen Altcode belegt sein.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** gemeinsam mit Plan 024
- **Kategorie:** IAM-UI-Aktionspriorität, CRAP
- **Geplant auf:** `98e6ca3d7`, 15. August 2026
- **Fallow vorher:** `buildOperationsPrimaryAction` in `-instances-shared.tsx:619` hat CC 30, Cognitive 28, 131 Zeilen und CRAP 33 bei geschätzter hoher Coverage; lokaler Clone `dup:a9825bed` umfasst 16 Zeilen.
- **Umsetzung:** Draft-PR #1011; die getrennte Prioritätsmatrix und der Source-Diff sind durch Root-Review freigegeben.
- **Fallow nachher:** `buildOperationsPrimaryAction` ist nur noch der typisierte New-/Existing-Dispatcher; der Zielanker und sein lokaler Clone sind aus den Findings verschwunden. Der Coverage-gebundene New-only-Audit meldet keine eingeführte Complexity, keinen moderaten CRAP-Befund und keine eingeführte Duplikation.

## Warum und Produktionsreichweite

Die Funktion wählt aus Realm-Modell, Schrittzuständen, erlaubten Aktionen und Mutationsfehlern genau eine primäre Admin-Aktion. Verdeckte Prioritätsänderungen können gefährliche oder wirkungslose IAM-Aktionen hervorheben. Sie teilt Owner, Datei, Tests und Rollback-Grenze mit Plan 024, ist aber separat zu charakterisieren.

## Scope

**In Scope:** `buildOperationsPrimaryAction`, unmittelbar benötigte interne typed Helper, dieselben beiden Testdateien sowie gemeinsamer OpenSpec-/Changelog-Scope.

**Out of Scope:** neue Actions, Berechtigungsprüfung, Mutationseffekte, Übersetzungen, Backend, Änderung des `RealmOperationsModel`.

## Characterization und Umsetzung

1. Baseline: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts` und `pnpm nx run sva-studio-react:test:types`; beide müssen grün sein.
2. Matrix gegen Altcode: kein möglicher Schritt; mehrere mögliche Schritte; blockierte, laufende, bereite und erfolgreiche Schritte; `focus_configuration`, Preflight, Plan, Provisionierung, Statusprüfung, Reconcile und Aktivierung; MutationError vorhanden/fehlend; New-/Existing-Realm; Follow-up-Actions; gleiche Priorität und Reihenfolge; `null`/`undefined`-Optionals.
3. Neue Fälle auf unverändertem Produktionscode grün ausführen und mit `git diff -- apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx` den fehlenden Source-Diff vor dem Refactor belegen.
4. Prioritätsentscheidung als kleine explizite, typisierte Kandidaten-/Auswahlfunktion ausdrücken. Kein frei konfigurierbares Ruleset und keine Reflection.
5. Bestehende Action-ID, Label-, Disabled-, Reason- und Navigation-Semantik unverändert lassen.

## Gates und Fertig-Kriterien

- `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts`
- `pnpm nx run sva-studio-react:test:coverage --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts`
- `pnpm nx run sva-studio-react:test:types`
- `pnpm nx run sva-studio-react:lint`
- `pnpm nx run sva-studio-react:build`
- `pnpm nx run sva-studio-react:test:a11y`; erwartet grün. Ein eigenes E2E-Journey-Target ist nicht anwendbar, weil Navigation und Interaktion unverändert bleiben und die Auswahlmatrix vollständig auf Modellebene charakterisiert wird.
- `pnpm complexity-gate`
- `pnpm exec openspec validate refactor-instance-realm-operations --strict`
- `pnpm check:file-placement`
- `pnpm check:studio-changelog`
- `git diff --check`
- Final einmal `pnpm test:pr`, wenn der zuvor gemessene affected Scope praktikabel ist; Auslassung und Ersatzgates dokumentieren.
- Vor Draft und nach jeder relevanten Source-Revision: `pnpm exec fallow audit --base origin/main --workspace sva-studio-react --explain --format json`. Erwartet: `PASS`, `complexity_introduced: 0`, `dead_code_introduced: 0`, `duplication_introduced: 0`, `styling_introduced: 0` und keine neuen moderaten CRAP-Findings. Coverageabhängiges CRAP mit echter `coverage-final.json` wiederholen.
- Fertig ist der Plan, wenn der Zielanker und der natürlich berührte lokale Clone verschwunden sind, ohne Änderung irgendeiner Matrixausgabe.

STOP bei unklarer Priorität, notwendiger Action-/Permission-Vertragsänderung, aktiver Source-/Testüberschneidung oder Bedarf an einer generischen Rules Engine. Vor Start außerdem STOP, wenn `update-instance-detail-module-tab` inzwischen `-instances-shared.tsx`, die zwei Modelltests oder dieselben Realm-Aktionsfixtures beansprucht.
