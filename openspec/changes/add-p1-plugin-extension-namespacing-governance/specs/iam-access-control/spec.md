## ADDED Requirements

### Requirement: Autorisierung konsumiert namespace-konsistente Plugin-Identitäten

Das System SHALL pluginbezogene Identitäten in Autorisierungspfaden namespace-konsistent verarbeiten.

#### Scenario: Plugin-Beitrag bleibt autorisierbar zuordenbar

- **WHEN** ein pluginbezogener Beitrag autorisiert werden muss
- **THEN** ist dessen technische Identität eindeutig dem owning Plugin zuordenbar
- **AND** mehrdeutige oder kollidierende Registrierungsnamen werden nicht akzeptiert
