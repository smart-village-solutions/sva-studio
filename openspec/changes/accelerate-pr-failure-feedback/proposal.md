# Change: PR-Fehler deutlich früher rückmelden

## Why

Die vorhandenen Quality Gates sichern Pull Requests fachlich sinnvoll ab, liefern bei roten Läufen aber häufig erst spät ein verwertbares Signal. In einer Stichprobe aktueller GitHub-Actions-Läufe lagen `Unit` im Median bei rund 7 Minuten und App-E2E bei rund 6 Minuten; einzelne rote Läufe benötigten 10 bis 14 Minuten. Dabei standen deterministische Fehler teilweise bereits mehrere Minuten vor dem terminalen Jobende fest. Wiederholte Fix-Pushes verlängern die Bearbeitung eines Pull Requests dadurch leicht um Stunden.

Der größte Hebel ist deshalb nicht das Entfernen einzelner Gates, sondern eine schnellere Reihenfolge und ein früher Abbruch bei eindeutigem Fehler. Die vollständige Merge-Absicherung bleibt erhalten, während direkt geänderte Projekte und E2E-Szenarien zuerst laufen, deterministische Fehler nicht pauschal wiederholt werden und unabhängige Testgruppen auf isolierten Runnern parallelisiert werden können.

## What Changes

- Ein paralleler PR-Fast-Feedback-Pfad prüft direkt geänderte Projekte und eindeutig zuordenbare App-Slices zuerst, ohne den vollständigen grünen Gate-Pfad seriell zu verlängern.
- PR-Unit-Läufe brechen nach einem bestätigten deterministischen Fehler ab. Der bisherige pauschale Retry des gesamten affected Unit-Scopes entfällt; nur klassifizierte Infrastrukturfehler dürfen gezielt wiederholt werden.
- Coverage wird zweiphasig ausgewertet: zuerst direkt geänderte Projekte einschließlich Paket-/Baseline-Verletzungen, danach der verbleibende affected beziehungsweise vollständige Scope samt globalem Gate.
- App-E2E läuft in Pull Requests fail-fast und darf in isolierte Shards mit jeweils eigenem App-/SSR-Server aufgeteilt werden. Main- und Nightly-Läufe sammeln weiterhin alle Fehler.
- Bestehende erforderliche Check-Namen bleiben als aggregierte, fail-closed Statuskontexte stabil. Kein Schutz wird entfernt oder auf einen optionalen Check verlagert.
- Deterministische Nx-Ergebnisse dürfen zwischen PR-Pushes wiederverwendet werden, wenn Inputs, Outputs und Restore-Äquivalenz nachgewiesen sind. Nicht deterministische E2E-/Integrationstests bleiben ungecacht; Coverage wird erst nach einem expliziten Determinismusnachweis cachefähig.
- CI-Summaries erfassen Scope, Phase, Cache-Hits und Laufzeiten, damit Median und P90 der Zeit bis zum ersten verwertbaren Fehler sowie die grüne Gesamtlaufzeit messbar bleiben.
- Die Einführung erfolgt gestuft mit Vertrags- und Paritätsprüfungen. Sharding und persistentes Coverage-Caching werden erst blockierend aktiviert, wenn Vollständigkeit und Ergebnisgleichheit belegt sind.

## Impact

- Affected specs: `monorepo-structure`, `test-coverage-governance`, `app-e2e-integration-testing`
- Affected code: `.github/workflows/quality-gates.yml`, `.github/workflows/runtime-gates.yml`, `.github/workflows/app-e2e.yml`, `.github/actions/setup-pnpm-workspace/action.yml`, `scripts/ci/affected-unit-gate.ts`, neue beziehungsweise erweiterte CI-Planer und Aggregatoren unter `scripts/ci/`, Nx-/Playwright-Konfiguration und zugehörige Tooling-Tests
- Affected configuration: `nx.json`, Root-Skripte sowie versionierte, sicher abgegrenzte GitHub-Actions-Cache- und Artifact-Verträge
- Affected docs: `DEVELOPMENT_RULES.md`, CI-/Testing-Dokumentation und arc42-Abschnitte 04, 08, 10 und 11
- Operational rollout: Messbaseline → Fast Feedback und Fail-fast → Changed-first Coverage → isolierte Shards → nachgewiesener persistenter Cache
- Non-goals: keine Entfernung von Coverage-, Unit-, Type-, Security-, Complexity- oder E2E-Schutz; keine Reduktion des geprüften Scopes; kein Nx Cloud; keine parallelen Playwright-Worker gegen denselben SSR-Server; keine Änderung des Rollout-/Deploymentpfads
