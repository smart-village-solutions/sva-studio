## ADDED Requirements

### Requirement: Plugin-Content-Typen und Fachbeiträge folgen Namespace-Regeln

Das System SHALL für pluginbezogene Content-Typen und fachliche Registrierungen verbindliche Namespace-Regeln verwenden.

#### Scenario: Content-Typ nutzt abgeleiteten Plugin-Namensraum

- **WHEN** ein Plugin einen Content-Typ registriert
- **THEN** ist dessen technische Identität eindeutig auf die Plugin-Identität zurückführbar
- **AND** Kollisionen mit fremden oder hosteigenen Typen werden verhindert

#### Scenario: Fachbeiträge bleiben konsistent benannt

- **WHEN** ein Plugin zusätzliche fachliche Beiträge wie Such-Facets oder Editor-Sektionen beschreibt
- **THEN** verwenden diese denselben Namensraum wie die übrigen Plugin-Beiträge
- **AND** gemischte oder uneinheitliche Benennung gilt als Governance-Verstoß
