## ADDED Requirements

### Requirement: PR-Coverage konsumiert den kanonischen Run-Scope

Das System SHALL die vorhandene Changed-first-Coverage-Planung aus der einmaligen allgemeinen PR-Scope-Evidenz ableiten. Coverage SHALL keine zweite allgemeine Pfad- oder Relevanzentscheidung implementieren und SHALL weiterhin genau einen stabilen, fail-closed Required-Kontext `Coverage` veröffentlichen.

#### Scenario: Normaler Coverage-relevanter Pull Request

- **WHEN** der kanonische PR-Scope coverage-relevante Projekte für den exakten Head-SHA enthält
- **THEN** leitet der vorhandene Coverage-Planer daraus seine direkte und verbleibende disjunkte Phase ab
- **AND** führt der Coverage-Workflow keine allgemeine Scope- oder `paths-filter`-Auswertung erneut aus
- **AND** bleiben Paket-Floors, Baseline-Deltas, globale Coverage und Exemptions unverändert wirksam

#### Scenario: Globaler Full-Fallback

- **WHEN** der kanonische Scope einen vollständigen sicheren Fallback verlangt
- **THEN** führt Coverage den vollständigen Coverage-Vertrag aus
- **AND** darf weder Sharding noch Orchestrierung ein Projekt oder eine globale Regel auslassen

#### Scenario: Scope-Artefakt gehört zu einem anderen Head

- **WHEN** der Coverage-Pfad eine fehlende, veraltete oder Fremd-SHA-gebundene Scope-Evidenz erhält
- **THEN** schlägt der Required-Kontext `Coverage` fail-closed fehl
- **AND** ersetzt keine lokale YAML-Pfadprüfung die ungültige Evidenz

### Requirement: Coverage-Orchestrierung bewahrt Ergebnisparität ohne Doppelarbeit

Das System SHALL beim Übergang auf die konsolidierte Topologie für denselben Head-SHA denselben Coverage-Scope und dieselbe terminale Gate-Entscheidung wie der bestehende Vertrag liefern. Bestehende Coverage-Phasen, Shard-Evidenz und Aggregation SHALL wiederverwendet und nicht durch einen zweiten Shadow-Aggregator dupliziert werden.

#### Scenario: Coverage-Shadow wird verglichen

- **WHEN** die konsolidierte Topologie nicht blockierend neben der Alt-Orchestrierung läuft
- **THEN** werden vorhandener Plan, erwartete Shards und terminales Ergebnis SHA-genau verglichen
- **AND** wird kein zweiter fachlicher Coverage-Planer oder Aggregator eingeführt

#### Scenario: Coverage-Teilresultat fehlt

- **WHEN** ein erwartetes Teilresultat fehlt, überlappt, doppelt, veraltet oder nicht auswertbar ist
- **THEN** bleibt der bestehende fail-closed Aggregator rot
- **AND** kann die konsolidierte Workflow-Topologie das Ergebnis nicht überschreiben

#### Scenario: Coverage und App Build betreffen denselben Pull Request

- **WHEN** Coverage und App Build für dasselbe Event und Head-SHA erforderlich sind
- **THEN** führt Coverage ausschließlich seinen Coverage-Vertrag aus
- **AND** wird der App-Build-Vertrag genau einmal durch seinen ausgewiesenen Job ausgeführt
