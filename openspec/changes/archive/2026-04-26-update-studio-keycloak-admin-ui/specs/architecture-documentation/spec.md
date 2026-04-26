## ADDED Requirements

### Requirement: arc42 documentation reflects implemented architecture

Die arc42-Dokumentation SHALL Studio als alternative Keycloak-Admin-UI, Keycloak-first Mutationen und die Scope-Trennung zwischen Platform und Tenant beschreiben.

#### Scenario: Architecture docs cover Keycloak-first IAM
- **WHEN** der Change umgesetzt wird
- **THEN** dokumentieren die betroffenen arc42-Abschnitte System-of-Record, Read-Models, Sync-/Reconcile-Flows, Bearbeitbarkeitsmatrix und Audit-Verhalten
- **AND** die Doku nennt die Grenzen gegenüber vollständiger Keycloak-Realm-/Client-Administration
