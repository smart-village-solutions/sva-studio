## ADDED Requirements

### Requirement: Erweiterungstiefen begrenzen autorisierungsrelevante Eingriffstiefe

Das System SHALL über Erweiterungstiefen begrenzen, welche autorisierungsrelevanten Oberflächen ein Package nutzen darf.

#### Scenario: Fachpackage erweitert keine Host-Autorisierung

- **WHEN** ein Fachpackage einer niedrigen Erweiterungstiefe zugeordnet ist
- **THEN** kann es keine hostnahen Autorisierungsoberflächen beanspruchen
- **AND** sicherheitskritische Eingriffe bleiben höher klassifizierten Packages vorbehalten
