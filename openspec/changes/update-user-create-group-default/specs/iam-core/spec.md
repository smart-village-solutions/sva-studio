## MODIFIED Requirements
### Requirement: Keycloak Admin API Integration

Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Rollen und Rollenzuordnungen im jeweiligen Platform- oder Tenant-Scope vollständig listen, bearbeiten und synchronisieren zu können. Keycloak bleibt System of Record für Identitäten und Realm-Rollen; Studio stellt eine auditierte Admin-UI und synchronisierte Fachansicht bereit.

#### Scenario: Keycloak-first user mutation

- **WHEN** ein berechtigter Admin einen User im Studio erstellt, deaktiviert oder Profilfelder ändert
- **THEN** führt das System die Mutation zuerst gegen Keycloak aus
- **AND** synchronisiert anschließend das Studio-Read-Model
- **AND** bei Benutzererstellung dürfen initial sowohl direkte `roleIds` als auch `groupIds` übergeben werden
- **AND** das System schreibt initiale Gruppenmitgliedschaften im aktiven Instanzkontext, wenn `groupIds` gesetzt sind
- **AND** direkte Rollen bleiben optionale additive Zuweisungen
- **AND** bei nachgelagertem Sync-Fehler bleibt der Keycloak-Zustand sichtbar und wird als Drift gemeldet
