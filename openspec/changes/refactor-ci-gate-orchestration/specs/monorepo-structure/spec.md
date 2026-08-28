## ADDED Requirements

### Requirement: Konsolidierte PR-Gate-Orchestrierung besitzt genau einen Scope-Owner

Das Monorepo SHALL pro Pull-Request-Workflow-Run genau eine allgemeine, versionierte und an Base- sowie Head-SHA gebundene Scope-Entscheidung erzeugen. Alle PR-Gates SHALL diese Entscheidung konsumieren, ohne den allgemeinen Scope oder eine parallele Pfadpolicy erneut zu bestimmen.

#### Scenario: Normaler affected Pull Request

- **WHEN** ein Pull Request eindeutig zuordenbare Workspace-Dateien ändert
- **THEN** erzeugt der kanonische Scope-Job genau einen Plan für den exakten Base- und Head-SHA
- **AND** konsumieren alle nachgelagerten PR-Gates denselben Plan
- **AND** führen sie `pr-scope.cli.ts` oder eine allgemeine `paths-filter`-Policy nicht erneut aus

#### Scenario: Docs-only Pull Request

- **WHEN** der kanonische Scope alle fachlichen Ausführungen eines Required Gates ausdrücklich als irrelevant klassifiziert
- **THEN** veröffentlicht der PR-Workflow dennoch die sieben Required-Kontexte terminal für den exakten Head-SHA
- **AND** gilt ein Skip nur aufgrund der versionierten Scope-Evidenz als erfolgreich
- **AND** bleibt kein Required Check dauerhaft im Zustand `expected`

#### Scenario: Scope ist unsicher

- **WHEN** Base-SHA, Head-SHA, Projektgraph oder Dateizuordnung nicht sicher ausgewertet werden kann
- **THEN** fällt der Plan auf den vollständigen sicheren Scope zurück
- **AND** lässt die Orchestrierung kein Gate aufgrund einer Heuristik aus

#### Scenario: Scope-Evidenz ist ungültig

- **WHEN** die Scope-Evidenz fehlt, veraltet, doppelt, nicht auswertbar oder an ein anderes Head-SHA gebunden ist
- **THEN** schlägt jeder davon abhängige Required-Pfad fail-closed fehl
- **AND** kann kein impliziter Skip den fehlenden Vertrag ersetzen

### Requirement: Konsolidierte PR-Gates bewahren stabile Required-Kontexte

Das Monorepo SHALL nach jeder Orchestrierungsmigration für jeden Pull-Request-Head exakt die öffentlichen Required-Kontexte `Lint`, `Unit`, `Types`, `Complexity`, `PR Integration`, `File Placement` und `Coverage` veröffentlichen. Interne Phasen und Shards SHALL Implementierungsdetails bleiben und über die bestehenden fail-closed Aggregatoren ausgewertet werden.

#### Scenario: Interne Unit- oder Coverage-Phasen laufen parallel

- **WHEN** ein Required Gate mehrere interne Teiljobs ausführt
- **THEN** veröffentlicht ausschließlich der stabile finale Aggregator den Required-Kontext
- **AND** akzeptiert er nur vollständige, disjunkte und Head-SHA-gebundene Ergebnisse

#### Scenario: Required-Teiljob fehlt oder schlägt fehl

- **WHEN** ein erwarteter Teiljob fehlt, rot, abgebrochen, veraltet oder nicht ausdrücklich übersprungen ist
- **THEN** ist der zugehörige stabile Required-Kontext rot
- **AND** bleiben die Namen der sechs übrigen Required-Kontexte unverändert veröffentlicht

### Requirement: Main- und Nightly-Verifikation bleibt vom Releasepfad getrennt

Das Monorepo SHALL vollständige nicht deploymentbezogene Prüfungen für `main` und Nightly in einem von Pull-Request-Gates getrennten Verifikationsworkflow ausführen. Der kanonische Build-, Main-E2E- und Promote-Pfad SHALL eigenständig und unverändert bleiben.

#### Scenario: Push auf main

- **WHEN** ein Commit auf `main` veröffentlicht wird
- **THEN** führt der Verifikationsworkflow den vollständigen nicht deploymentbezogenen Gate-Scope ohne PR-`affected`-Einschränkung aus
- **AND** übernimmt er keine PR-erzeugte Scope- oder Cache-Evidenz
- **AND** besitzt `build.yml` weiterhin allein den Runtime-Artefakt- und Image-Build

#### Scenario: Nightly-Verifikation

- **WHEN** der geplante Nightly-Lauf startet
- **THEN** führt er die vollständige diagnostische Prüfung aus
- **AND** kann sein Ergebnis weder Main-E2E- noch Staging-Release-Evidenz ersetzen

#### Scenario: Regulärer Release

- **WHEN** ein verifizierter Main-Commit nach Dev, Staging oder Production befördert wird
- **THEN** bleiben Build, automatisches Dev, kanonisches Main-E2E, Staging-Preflight und Same-Digest-Production fachlich unverändert
- **AND** greift die Gate-Konsolidierung nicht in Backup-, Restore- oder Promote-Mutationen ein

### Requirement: CI-Konsolidierung reduziert Ownership messbar

Das Monorepo SHALL die vier abgelösten allgemeinen Orchestrierungsworkflows durch eine Zieltopologie ersetzen, die mindestens 20 Prozent weniger produktive YAML-Zeilen besitzt, keine Nettozunahme produktiver CI-Orchestrierungs-TS-Zeilen verursacht und denselben App-Build- oder Gate-Vertrag pro Event-/SHA-Kontext höchstens einmal ausführt.

#### Scenario: Shadow-Parität wird abgenommen

- **WHEN** mindestens 20 repräsentative Shadow-Läufe für identische Head-SHAs ausgewertet werden
- **THEN** stimmen Scope-Plan und terminale Endentscheidung mit der Alt-Orchestrierung überein
- **AND** verschlechtert sich die mediane terminale Zeit grüner Required Checks um höchstens 30 Sekunden

#### Scenario: Cutover ist bereit

- **WHEN** die Shadow-Parität vollständig und ohne ungeklärte Abweichung nachgewiesen ist
- **THEN** erfolgt der Wechsel aller sieben Required-Kontexte atomar
- **AND** werden Altworkflows erst nach erfolgreicher Veröffentlichung am exakten Cutover-Head gelöscht

#### Scenario: Löschbilanz wird geprüft

- **WHEN** der Cutover abgeschlossen ist
- **THEN** umfassen die produktiven YAML-Nachfolger der vier Ausgangsworkflows höchstens 840 Zeilen
- **AND** ist die Nettoänderung produktiver CI-Orchestrierungs-TS-Zeilen höchstens null
- **AND** läuft kein App-Build- oder Gate-Vertrag doppelt für denselben Event-/SHA-Kontext
