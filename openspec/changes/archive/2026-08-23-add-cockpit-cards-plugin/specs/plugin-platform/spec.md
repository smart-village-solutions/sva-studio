## ADDED Requirements

### Requirement: Cockpit Cards besitzen einen eigenständigen Plugin- und IAM-Vertrag

Das System MUST `@sva/plugin-cockpit-cards` als eigenständiges Plugin mit den Actions `cockpit-cards.read`, `cockpit-cards.create`, `cockpit-cards.update` und `cockpit-cards.delete` registrieren. Cockpit Cards dürfen nicht die FAQ- oder Generic-Items-Actions wiederverwenden.

#### Scenario: Cockpit-Cards-Berechtigungen werden getrennt ausgewertet

- **WHEN** der Host eine Cockpit-Cards-Operation autorisiert
- **THEN** prüft er die passende Action im Namespace `cockpit-cards`
- **AND** gewährt eine FAQ- oder Generic-Items-Berechtigung allein keinen Zugriff
