## ADDED Requirements

### Requirement: Build-time-Plugin-Beiträge folgen expliziten Registrierungsphasen

Das System SHALL Build-time-Plugin-Beiträge entlang expliziter Registrierungsphasen materialisieren.

#### Scenario: Host kennt benannte Materialisierungsphasen

- **WHEN** der Host Plugin-Beiträge verarbeitet
- **THEN** geschieht dies in dokumentierten Phasen statt über implizite Reihenfolge
- **AND** neue Beitragsarten ordnen sich in diese Phasen ein

#### Scenario: Ad-hoc-Erweiterungspunkt ist nicht automatisch zulässig

- **WHEN** ein neuer Plugin-Beitrag ohne definierte Phase eingeführt werden soll
- **THEN** gilt dies nicht als Teil des bestehenden Vertrags
- **AND** der Erweiterungspunkt benötigt eine explizite Einordnung
