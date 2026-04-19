## ADDED Requirements

### Requirement: Content-Beiträge werden in einer eigenen Registrierungsphase verarbeitet

Das System SHALL pluginbezogene Content-Beiträge in einer expliziten Inhaltsphase materialisieren.

#### Scenario: Content-Typ wird vor UI- oder Routing-Projektion registriert

- **WHEN** ein Plugin Content-Typen oder Content-Metadaten bereitstellt
- **THEN** verarbeitet der Host diese Beiträge in einer definierten Inhaltsphase
- **AND** nachgelagerte UI- oder Routing-Phasen konsumieren das Ergebnis deterministisch
