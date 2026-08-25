# Change: PR-Fehler früher rückmelden und E2E vor Staging verankern

## Why

Die vorhandenen Quality Gates sichern Pull Requests fachlich überwiegend sinnvoll ab, liefern bei roten Läufen aber häufig erst spät ein verwertbares Signal. In einer Stichprobe aktueller GitHub-Actions-Läufe lag `Unit` im Median bei rund 7 Minuten. Der vollständige App-E2E-Lauf benötigt meist weitere 6 bis 8 Minuten, startet Browser, App und mehrere Pflichtdienste und wird bei jedem E2E-relevanten PR-Push erneut ausgeführt. Wiederholte Fix-Pushes verlängern die Bearbeitung eines Pull Requests dadurch leicht um Stunden.

Unit-, Type-, Lint-, Coverage-, Integrations- und Build-Gates bleiben im PR. Der vollständige App-E2E-Lauf wird dagegen bewusst aus dem PR entfernt und genau einmal pro Push auf `main` ausgeführt. Ein regulärer Staging-Promote darf erst mutieren, wenn für den exakten `change_head` ein erfolgreicher vollständiger E2E-Lauf vorliegt. Damit wird keine zweite vermeintlich kleine PR-Smoke-Suite aufgebaut, deren Scope und Abhängigkeiten erneut wachsen würden. Der akzeptierte Trade-off ist, dass `main` und Dev vorübergehend eine Regression enthalten können; Staging und Production bleiben fail-closed geschützt.

## What Changes

- Ein paralleler PR-Fast-Feedback-Pfad prüft direkt geänderte Projekte und eindeutig zuordenbare App-Unit-Slices zuerst, ohne den vollständigen grünen Gate-Pfad seriell zu verlängern.
- PR-Unit-Läufe brechen nach einem bestätigten deterministischen Fehler ab. Der bisherige pauschale Retry des gesamten affected Unit-Scopes entfällt; nur klassifizierte Infrastrukturfehler dürfen gezielt wiederholt werden.
- Coverage wird zweiphasig ausgewertet: zuerst direkt geänderte Projekte einschließlich Paket-/Baseline-Verletzungen, danach der verbleibende affected beziehungsweise vollständige Scope samt globalem Gate.
- App-E2E wird weder im GitHub-PR-Workflow noch als Teil von `pnpm test:pr` ausgeführt. Es entsteht keine alternative PR-Smoke-Suite und keine E2E-Ownership- oder Shard-Matrix.
- Jeder Push auf `main` löst einen vollständigen App-E2E-Lauf aus. Nightly bleibt als nicht releasefähige Drift-Diagnose bestehen; manuelle Läufe dürfen diagnostizieren, erzeugen aber keine Staging-fähige Release-Evidenz.
- Der vollständige Main-E2E-Lauf erzeugt eine maschinenlesbare Evidenz mit Workflow, Event, Branch und exaktem Head-SHA. Der bestehende Image-Vertrag attestiert separat, dass der Ziel-Digest dieselbe OCI-Revision trägt.
- Ein regulärer Staging-Promote prüft diese E2E-Evidenz vor Backup, One-shots und App-Deployment fail-closed für `change_head`. Fehlende, laufende, rote, abgebrochene oder einem anderen Commit zugeordnete Evidenz blockiert vor jeder Mutation.
- Bestehende erforderliche Unit-, Coverage- und weitere PR-Check-Namen bleiben als aggregierte, fail-closed Statuskontexte stabil.
- Deterministische Nx-Ergebnisse dürfen zwischen PR-Pushes wiederverwendet werden, wenn Inputs, Outputs und Restore-Äquivalenz nachgewiesen sind. Nicht deterministische E2E-/Integrationstests bleiben ungecacht; Coverage wird erst nach einem expliziten Determinismusnachweis cachefähig.
- CI-Summaries erfassen Scope, Phase, Cache-Hits und Laufzeiten, damit Median und P90 der Zeit bis zum ersten verwertbaren PR-Fehler sowie die grüne Gesamtlaufzeit messbar bleiben. Main-E2E und Staging-Preflight dokumentieren zusätzlich die SHA-gebundene Übergabe.
- Die Einführung erfolgt gestuft mit Vertrags- und Paritätsprüfungen. Persistentes Coverage-Caching wird erst blockierend aktiviert, wenn Vollständigkeit und Ergebnisgleichheit belegt sind.

## Impact

- Affected specs: `monorepo-structure`, `test-coverage-governance`, `app-e2e-integration-testing`, `deployment-topology`
- Affected code: `.github/workflows/quality-gates.yml`, `.github/workflows/runtime-gates.yml`, `.github/workflows/app-e2e.yml`, `.github/workflows/promote.yml`, `.github/actions/setup-pnpm-workspace/action.yml`, `scripts/ci/run-pr-gate.ts`, `scripts/ci/affected-unit-gate.ts`, neue beziehungsweise erweiterte CI-Evidenz- und Promote-Preflight-Verträge unter `scripts/ci/`, Nx-/Playwright-Konfiguration und zugehörige Tooling-Tests
- Affected configuration: `nx.json`, Root-Skripte sowie versionierte, sicher abgegrenzte GitHub-Actions-Cache- und Artifact-Verträge
- Affected docs: `DEVELOPMENT_RULES.md`, CI-/Testing-Dokumentation, `docs/guides/studio-rollout-process.md` und arc42-Abschnitte 04, 07, 08, 10 und 11
- Operational rollout: Messbaseline → Fast Feedback und Fail-fast → Changed-first Coverage → Main-E2E-Evidenz → blockierender Staging-Preflight → nachgewiesener persistenter Cache
- Non-goals: keine zweite kleine PR-E2E-Suite; keine E2E-Scope- oder Ownership-Heuristik; keine Abschwächung von Coverage-, Unit-, Type-, Security- oder Complexity-Schutz; kein Nx Cloud; keine Behauptung, dass der lokale Playwright-Lauf das Containerartefakt testet; keine Änderung am geschützten Same-Digest-Pfad von Staging nach Production
