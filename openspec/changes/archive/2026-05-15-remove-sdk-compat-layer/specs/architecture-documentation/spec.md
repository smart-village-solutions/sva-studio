## MODIFIED Requirements
### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive entfernter alter Importpfade, aktivierter Enforcement-Regeln und verbleibender historischer Altlast ausserhalb des aktiven Scopes.

#### Scenario: Sammelpfad wurde vollstaendig entfernt

- **WHEN** ein alter Sammelpfad wie `@sva/sdk` aus dem aktiven Workspace entfernt wurde
- **THEN** beschreiben aktive Architektur-, Entwicklungs- und Governance-Quellen den Pfad nicht mehr als verfuegbaren Vertrag
- **AND** nennen sie stattdessen die kanonischen Ersatzimporte
