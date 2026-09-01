## 1. Reconciliation und Vertragsfundament

- [x] 1.1 Vor der Umsetzung Workflow-LOC, Jobmatrix, Live-Ruleset und aktive parallele Changes gegen `docs/reports/ci-gate-ownership-baseline-2026-08.md` reconciliieren.
- [x] 1.2 Die vorhandenen Changed-first-, Unit-, Coverage-, Evidenz- und Aggregatorverträge inventarisieren und ihre unveränderte Wiederverwendung per Contract-Test absichern.
- [x] 1.3 Einen versionierten, Base-/Head-SHA-gebundenen allgemeinen PR-Scope-Vertrag festlegen, den alle PR-Gates ohne zweite Pfadpolicy konsumieren.

## 2. Nicht blockierende Zieltopologie

- [x] 2.1 Den konsolidierten PR-Gate-Workflow mit genau einer allgemeinen Scope-Entscheidung und den sieben stabilen Required-Jobnamen im Shadow-Modus ergänzen.
- [x] 2.2 Den getrennten Main-/Nightly-Verifikationsworkflow ohne PR-Scope- oder PR-Cache-Übernahme im Shadow-Modus ergänzen.
- [x] 2.3 A11y, App Build, Documentation Integrity, Documentation Catalog und DB Schema Snapshot ohne Abschwächung und ohne eigene allgemeine Pfadpolicy in die Zieltopologie einordnen.
- [x] 2.4 Sicherstellen, dass `build.yml`, `app-e2e.yml`, `promote.yml`, Security-, Monitoring-, Schema-Diff-, Backup-, Restore-, Cutover- und Spezialrelease-Workflows unverändert bleiben.

## 3. Parität und Messung

- [x] 3.1 Contract-Tests für Docs-only-No-op, normalen affected PR, globalen Full-Fallback, fehlgeschlagenes Required Gate und vollständigen Main-/Nightly-Lauf ergänzen.
- [x] 3.2 Negative Tests für fehlenden, veralteten oder Fremd-SHA-Scope, fehlenden Required-Job und unzulässige PR-Cache-Übernahme nach `main` ergänzen.
- [x] 3.3 Mindestens 20 repräsentative Shadow-Läufe SHA-genau auf identische Scope-Pläne und terminale Endergebnisse auswerten.
- [x] 3.4 Für die parallele Shadow-Phase eine gepaarte Median-Regression grüner Unit-/Coverage-Endzeiten von höchstens 90 Sekunden nachweisen.
- [ ] 3.5 Nach dem Cutover an zehn repräsentativen PR-Läufen nachweisen, dass kein App-Build- oder Gate-Vertrag für denselben Event-/SHA-Kontext doppelt läuft und der Unit-/Coverage-Median höchstens 90 Sekunden über der akzeptierten Baseline liegt. Die erste Zehn-Läufe-Stichprobe belegt fehlende Doppelarbeit, verfehlt mit 445 Sekunden aber die Grenze von 438 Sekunden. Nach Entfernung der unbegründeten Workspace-Installation aus dem Scope-Job ist eine neue Zehn-Läufe-Stichprobe erforderlich.

## 4. Atomarer Cutover und Löschung

- [x] 4.1 Vor dem Cutover das aktive Ruleset erneut lesen und bei jeder Abweichung von den sieben vereinbarten Kontexten stoppen.
- [x] 4.2 Die sieben Required-Kontexte atomar auf die neue Topologie umschalten, ohne Ruleset-Namen zu verändern. PR `#1234` veröffentlichte die produktive Topologie; Ruleset `11600196` blieb unverändert bei exakt sieben Required-Kontexten.
- [x] 4.3 Am exakten Cutover-Head alle Required-Kontexte und die vollständige Main-/Release-Abgrenzung verifizieren; erst danach die vier Alt-Orchestrierungsworkflows löschen. Der exakte PR-Head bestand alle Required-Kontexte; die Altworkflows wurden im selben Merge entfernt. Nach dem isolierten SonarCloud-Fix in PR `#1244` bestand Main-Run `33545756366` die vollständige Main-Topologie einschließlich Coverage und SonarCloud.
- [x] 4.4 Eine produktive YAML-Summe von höchstens 840 Zeilen und keine Nettozunahme produktiver CI-Orchestrierungs-TS-Zeilen nachweisen.

## 5. Dokumentation und Abschluss

- [x] 5.1 `docs/architecture/04-solution-strategy.md`, `07-deployment-view.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` mit Zieltopologie, Evidenzownership, Qualitätszielen und Restschuld fortschreiben.
- [x] 5.2 Die aktuelle Testing-/CI-Dokumentation auf genau einen PR-Scope-Owner, vollständige Main-/Nightly-Verifikation und den unveränderten Rolloutpfad aktualisieren.
- [x] 5.3 Relevante Workflow-Contract-, Tooling-Unit-, Type-, File-Placement- und strikte OpenSpec-Gates ausführen und die SHA-gebundene Parität dokumentieren.
- [ ] 5.4 Den Change erst nach Cutover, Löschbilanz und nachgewiesener Zielerfüllung archivieren.
