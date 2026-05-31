## ADDED Requirements
### Requirement: Architekturdoku beschreibt scoped role permissions als getrenntes IAM-Pattern
Das System SHALL die neue Rollen-Rechte-Scope-Logik in der Architekturdokumentation als eigenes IAM-Pattern mit klarer Abgrenzung zu `permission.scope` dokumentieren.

#### Scenario: Architektur trennt Assignment-Scope von ABAC-Scope
- **WHEN** die Architektur- oder Entwicklungsdokumentation die IAM-Autorisierung beschreibt
- **THEN** unterscheidet sie explizit zwischen `role_permissions.access_scope` und dem generischen ABAC-Feld `permissions.scope`
- **AND** sie nennt die benoetigten Resource-Attribute fuer `own` und `organization`
