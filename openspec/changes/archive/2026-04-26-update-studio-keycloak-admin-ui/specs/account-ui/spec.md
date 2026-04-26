## ADDED Requirements

### Requirement: Studio Keycloak Admin UI

The Studio admin UI SHALL allow authorized platform and tenant admins to use Studio as an alternative UI for Keycloak user and role administration.

#### Scenario: Complete user list with edit affordances
- **WHEN** ein Admin `/admin/users` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-User mit Such-, Status-, Rollen- und Mapping-Filtern
- **AND** zeigt pro User, ob Bearbeitung, Deaktivierung und Rollenzuordnung möglich, read-only oder blockiert ist

#### Scenario: Complete role list with edit affordances
- **WHEN** ein Admin `/admin/roles` öffnet
- **THEN** zeigt die UI alle im aktiven Scope relevanten Keycloak-Rollen mit Such-, Typ- und Bearbeitbarkeitsfiltern
- **AND** unterscheidet Built-in-, externe und Studio-managed Rollen sichtbar

#### Scenario: Sync diagnostics are actionable
- **WHEN** ein Sync oder Reconcile `partial_failure`, `blocked` oder `failed` meldet
- **THEN** zeigt die UI Zähler, Diagnosecodes und betroffene User/Rollen
- **AND** bietet nur Aktionen an, die im aktiven Scope und laut Bearbeitbarkeitsmatrix erlaubt sind
