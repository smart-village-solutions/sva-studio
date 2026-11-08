## ADDED Requirements

### Requirement: Vollständige verteilte Testnachweise

Das System SHALL verteilte Unit-, Coverage- und E2E-Ergebnisse nur dann als vollständig freigeben, wenn alle erwarteten Teilmengen erfolgreich und an dieselbe erwartete Quelle gebunden nachgewiesen sind.

#### Scenario: Fehlender oder fremder Shard

- **WHEN** ein erwarteter Shard fehlt, fehlschlägt oder zu einem anderen Commit gehört
- **THEN** bleibt die aggregierte Freigabe blockiert

#### Scenario: Vollständige Coverage

- **WHEN** alle instrumentierten Teilberichte eines Projekts validiert vorliegen
- **THEN** werden die zusammengeführten Zähler mit unveränderten Qualitätsregeln geprüft
