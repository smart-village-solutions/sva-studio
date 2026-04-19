## ADDED Requirements

### Requirement: Content-Aktionen bleiben fachlich lesbar, aber sicherheitlich auf Primitive zurückgeführt

Das System SHALL fachliche Content-Aktionen für Benutzer verständlich halten und zugleich sicherheitlich auf primitive Rechte zurückführen.

#### Scenario: Fachaktion bleibt nachvollziehbar

- **WHEN** ein Benutzer eine fachliche Aktion wie Archivieren oder Veröffentlichen ausführt
- **THEN** bleibt die Aktion in UI und Fachlogik lesbar benannt
- **AND** die zugrunde liegende Berechtigungsprüfung erfolgt über das zentrale Mapping
