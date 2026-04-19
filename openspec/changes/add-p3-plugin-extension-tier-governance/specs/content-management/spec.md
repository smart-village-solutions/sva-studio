## ADDED Requirements

### Requirement: Content-Erweiterungen respektieren ihre zulässige Erweiterungstiefe

Das System SHALL Content-Erweiterungen nur die Host-Fähigkeiten öffnen, die ihrer zugeordneten Erweiterungstiefe entsprechen.

#### Scenario: Fachlicher Content-Typ bleibt innerhalb seiner Klasse

- **WHEN** ein Content-Plugin einen fachlichen Typ ergänzt
- **THEN** verwendet es nur die für seine Erweiterungstiefe vorgesehenen Content-Oberflächen
- **AND** es beansprucht keine plattformnahen Sonderrechte ohne gesonderte Governance
