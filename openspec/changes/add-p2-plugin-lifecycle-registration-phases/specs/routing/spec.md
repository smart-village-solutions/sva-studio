## ADDED Requirements

### Requirement: Routing wird erst nach vorgelagerten Plugin-Phasen materialisiert

Das System SHALL Plugin-Routing als explizite Registrierungsphase behandeln, die auf vorgelagerte Host-Projektionen aufsetzt.

#### Scenario: Routing folgt auf Identitäts- und Beitragsphase

- **WHEN** der Host Plugin-Routen materialisiert
- **THEN** liegen die erforderlichen Plugin-Identitäten und Beitragsdefinitionen bereits in vorgelagerten Phasen vor
- **AND** Routing ist kein isolierter Sonderpfad neben anderen Registrierungen
