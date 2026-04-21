## MODIFIED Requirements

### Requirement: Keycloak Admin API Integration

Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Rollen und Rollenzuordnungen im jeweiligen Platform- oder Tenant-Scope vollständig listen, bearbeiten und synchronisieren zu können. Keycloak bleibt System of Record für Identitäten und Realm-Rollen; Studio stellt eine auditierte Admin-UI und synchronisierte Fachansicht bereit.

#### Scenario: Studio lists all platform Keycloak users
- **WHEN** ein Platform-Admin die Root-Userliste öffnet
- **THEN** lädt das System Platform-Realm-User über Keycloak-Admin-APIs mit serverseitiger Pagination, Suche und Count
- **AND** jeder zurückgegebene User enthält Keycloak-ID, Status, Profilfelder, Rollenprojektion und Bearbeitbarkeitsstatus

#### Scenario: Studio lists all tenant-relevant Keycloak users
- **WHEN** ein Tenant-Admin die Tenant-Userliste öffnet
- **THEN** lädt das System alle für den Tenant relevanten Keycloak-User
- **AND** User ohne vollständiges Studio-Mapping werden sichtbar als `unmapped` oder `manual_review` markiert
- **AND** die Liste bricht nicht wegen einzelner Mapping-Fehler ab

#### Scenario: Keycloak-first user mutation
- **WHEN** ein berechtigter Admin einen User im Studio erstellt, deaktiviert oder Profilfelder ändert
- **THEN** führt das System die Mutation zuerst gegen Keycloak aus
- **AND** synchronisiert anschließend das Studio-Read-Model
- **AND** bei nachgelagertem Sync-Fehler bleibt der Keycloak-Zustand sichtbar und wird als Drift gemeldet

#### Scenario: Studio lists all relevant Keycloak roles
- **WHEN** ein Admin die Rollenliste öffnet
- **THEN** lädt das System Realm-Rollen aus dem passenden Keycloak-Scope
- **AND** Studio zeigt Built-in-, externe und Studio-managed Rollen mit Bearbeitbarkeitsstatus
- **AND** read-only Rollen dürfen angezeigt und zugeordnet werden, wenn die Rechte-Matrix dies erlaubt

#### Scenario: Keycloak-first role mutation
- **WHEN** ein berechtigter Admin eine Studio-managed Rolle anlegt, ändert oder löscht
- **THEN** führt das System die Änderung gegen Keycloak aus
- **AND** synchronisiert anschließend Studio-Rollen- und Permission-Read-Models
- **AND** blockiert Mutationen an read-only oder extern gemanagten Rollen mit stabilem Diagnosecode

### Requirement: Keycloak User Synchronization Scope

The system SHALL run Keycloak user synchronization as a reconciliation flow that explains differences between Keycloak and Studio instead of hiding unmapped or partially failed objects.

#### Scenario: Sync reports unmapped users
- **WHEN** ein User-Sync Keycloak-User findet, die nicht sauber einem Studio-Kontext zugeordnet werden können
- **THEN** enthält der Sync-Report die Anzahl und Diagnosecodes dieser User
- **AND** die betroffenen User bleiben in der Studio-UI sichtbar, sofern der aktive Scope dies erlaubt

#### Scenario: Partial failure remains actionable
- **WHEN** ein Sync mit `partial_failure` endet
- **THEN** enthält der Report objektbezogene Ursachen wie `missing_instance_attribute`, `forbidden_role_mapping`, `read_only_federated_field` oder `idp_forbidden`
- **AND** Admins können daraus Reconcile- oder Runbook-Aktionen ableiten
