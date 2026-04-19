## ADDED Requirements

### Requirement: Fachliche Inhaltsaktionen werden auf primitive Studio-Rechte gemappt

Das System SHALL fachliche Inhalts- und Admin-Aktionen über ein zentrales Capability-Mapping auf primitive Studio-Rechte abbilden.

#### Scenario: Publish-Aktion wird auf primitive Rechte zurückgeführt

- **WHEN** eine fachliche Aktion wie `publish` autorisiert wird
- **THEN** verwendet das System ein zentrales Mapping auf primitive Studio-Rechte
- **AND** die finale Sicherheitsentscheidung basiert nicht auf verstreuter Sonderlogik

#### Scenario: Gleiches Mapping gilt in UI und API

- **WHEN** dieselbe fachliche Aktion in UI und API geprüft wird
- **THEN** greifen beide auf dieselbe Capability-Mapping-Semantik zu
- **AND** divergierende Sicherheitslogik zwischen Oberflächen ist nicht Teil des Zielbilds
