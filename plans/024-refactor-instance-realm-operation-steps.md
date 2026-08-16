# Plan 024: Realm-Operationsschritte deklarativ und semantikgleich aufbauen

> **Executor-Anweisung:** IAM-/Realm-Zustände sind sicherheitsrelevant. Vor dem Refactor muss eine kombinatorische Status-, Prioritäts-, Fallback- und Negativmatrix gegen Altcode grün sein.

## Status

- **Priorität:** P1
- **Aufwand:** M–L
- **Risiko:** HOCH
- **Abhängigkeit:** gemeinsam mit Plan 025 in Bundle B
- **Kategorie:** IAM-UI-Vertrag, Datenintegrität, Complexity, CRAP
- **Geplant auf:** `98e6ca3d7`, 15. August 2026
- **Fallow vorher:** `-instances-shared.tsx` hat 778 Zeilen, 39 Funktionen, Fan-in 4, CC gesamt 232, Cognitive gesamt 171, MI 79,6, fünf CRAP-Findings und Hotspot-Score 5,6 bei 22 Commits. Zielgruppe: `buildExistingRealmAssessmentSteps` CC 35/Cognitive 41/CRAP 299,6; `buildNewRealmArtifactSteps` 28/22/197,3; `buildNewRealmLeadSteps` 20/19/106,4; `buildWorkerPreflightStep` 17/29/79,4.
- **Ergebnis:** DONE – PR #1011, Merge-Commit `40787abc7d4e673c5eaa5e5d5ef16e64455be18d`
- **Umsetzung:** Characterization, Root-Review und unabhängiges IAM-/Semantikreview auf dem exakten PR-Head abgeschlossen.
- **Fallow nachher:** Die vier Zielanker sind aus den Complexity-/CRAP-Findings verschwunden. Die Datei hat 947 Zeilen, 63 kleine fachlich benannte Funktionen, CC gesamt 245, Cognitive gesamt 120, MI 80,8 und CRAP-Maximum 16,1; New-only meldet für Complexity, Dead Code, Duplikation und Styling jeweils 0 eingeführte Befunde.

## Warum und Produktionsreichweite

Die Builder bestimmen, welche Realm-Vertrags-, Preflight-, Provisionierungs-, Drift-, Reconcile- und Abschlusszustände Administratoren sehen und welche Aktion angeboten wird. Die Datei wird produktiv von Detail-Page-Helpers, Doctor-Modell und Detailseite konsumiert. Eine Prioritäts- oder Fallbackänderung kann einen fehlerhaften IAM-Zustand als bereit darstellen oder notwendige Reparatur verdecken.

## Scope

**In Scope:** die vier genannten Builder in `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`, ein minimales internes Modul im selben Route-Cluster, `-instances-shared.test.tsx` und `-instance-detail-models.test.ts`, OpenSpec `refactor-instance-realm-operations`, Changelog.

**Out of Scope:** Keycloak-/Registry-Backend, API-Aufrufe, Mutationswerte aus Plan 017/PR #1001, neue Actions, Übersetzungsinhalte, Realm-Vertragskorrekturen, `instance-interfaces*`, PR #983/#984.

**Aktive-Abgrenzung:** `update-instance-detail-module-tab` besitzt Module-Tab,
Navigation, Module-Workspace und deren Journey-/UI-Fixtures. Dieser Plan besitzt
nur das bestehende Realm-Operationsmodell und die zwei benannten Modelltests.
Vor Start den aktiven Change und Branch-Delta erneut prüfen; bei Datei-, Fixture-
oder Vertragsüberschneidung STOP.

## Characterization vor Refactoring

1. Baseline: `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts` sowie `pnpm nx run sva-studio-react:test:types` müssen grün sein.
2. New Realm: Vertrag vollständig/unvollständig; Preflight fehlt/ready/blocked inklusive `realm_mode`-Summary-Fallback; Plan fehlt/ready/blocked; Run planned/running/succeeded/failed; jedes Keycloak-Artefakt einzeln erfüllt/nicht erfüllt; Secret-Ausrichtung teilweise; finaler Status; exakte Schrittreihenfolge, Evidence Source, Timestamp, Request-ID und Action.
3. Existing Realm: Keycloak-Status fehlt/vorhanden; Drift ja/nein; letzter Run fehlt/failed/sonstig; Contract Repair; Reconcile-Bereitschaft; Result Validation; alle Summary-/Action-Prioritäten.
4. Falsche/fehlende optionale Runtime-Daten müssen fail-closed zur bisherigen Ausgabe führen.
5. Neue Matrixfälle auf unverändertem Produktionscode grün ausführen und mit `git diff -- apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx` den fehlenden Source-Diff vor dem Refactor belegen.

## Umsetzung

1. Wiederholte Step-Metadaten und Statusauflösung in fachlich benannte typed Helper/Descriptoren innerhalb des Route-Owners ziehen.
2. Status- und Summary-Entscheidungen getrennt lesbar halten; keine generische Workflow-Engine, keine neue öffentliche API.
3. Reihenfolge und Action-Priorität aus Characterization exakt bewahren. Nach jedem Builder-Block gezielte Tests ausführen.

## Gates und Fertig-Kriterien

- `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts`
- `pnpm nx run sva-studio-react:test:coverage --testFiles=src/routes/admin/instances/-instances-shared.test.tsx --testFiles=src/routes/admin/instances/-instance-detail-models.test.ts`
- `pnpm nx run sva-studio-react:test:types`
- `pnpm nx run sva-studio-react:lint`
- `pnpm nx run sva-studio-react:build`
- `pnpm nx run sva-studio-react:test:a11y`; erwartet grün, weil das Bundle die sichtbare Admin-Statusdarstellung berührt. Ein gesondertes E2E-Journey-Target ist nicht erforderlich, da weder Navigation noch Interaktion geändert wird; die exakten sichtbaren Modelle werden in den beiden Unit-Dateien geprüft.
- `pnpm complexity-gate`
- `pnpm exec openspec validate refactor-instance-realm-operations --strict`
- `pnpm check:file-placement`
- `pnpm check:studio-changelog`
- `git diff --check`
- Final einmal `pnpm test:pr`, wenn der zuvor gemessene affected Scope praktikabel ist; Auslassung und Ersatzgates dokumentieren.
- `pnpm exec fallow audit --base origin/main --workspace sva-studio-react --explain --format json`; erwartet `PASS`, `complexity_introduced: 0`, `dead_code_introduced: 0`, `duplication_introduced: 0`, `styling_introduced: 0` und keine moderaten CRAP-Neufunde. Coverageabhängiges CRAP mit der vom Coverage-Target erzeugten `coverage-final.json` erneut prüfen.
- Root-Review und unabhängiges IAM-/Semantikreview auf exaktem HEAD.
- Zielgruppe verschwindet, ohne Schritt, Reihenfolge, Status, Summary, Evidence, Timestamp, Request-ID oder Action zu ändern.

## STOP

- STOP, wenn Backend-, Registry-, Keycloak- oder öffentlicher UI-Vertrag geändert werden müsste.
- STOP bei Source-, Typ- oder Testfixture-Überschneidung mit einem aktiven Worktree/PR.
- STOP, wenn Legacy-Fallbacks nicht eindeutig charakterisierbar sind oder eine generische Workflow-Engine nötig würde.
