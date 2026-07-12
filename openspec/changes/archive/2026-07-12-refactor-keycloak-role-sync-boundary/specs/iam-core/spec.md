## ADDED Requirements
### Requirement: Keycloak-Rollenabgleich ist auf technische Sonderrollen begrenzt
Das System SHALL Keycloak-Rollen nur noch dort normativ verwalten oder abgleichen, wo sie für Plattform-Scope, Tenant-Bootstrap oder technische Realm-Verträge erforderlich sind. Tenantlokale Fachrollen werden nicht mehr allgemein als Keycloak-Realm-Rollen materialisiert oder gepflegt.

#### Scenario: Tenant-Custom-Rolle bleibt IAM-lokal
- **WHEN** ein `system_admin` im Tenant-Realm eine editierbare Custom-Rolle erstellt, ändert oder löscht
- **THEN** persistiert das System diese Mutation im tenantlokalen IAM-Rollenmodell
- **AND** führt dafür keine allgemeine Keycloak-Realm-Rollenmutation aus
- **AND** behandelt eine fehlende korrespondierende Keycloak-Rolle nicht als Drift des Sollmodells

#### Scenario: Technische Sonderrolle bleibt synchronisierbar
- **WHEN** der Bootstrap-, Repair- oder Schutzpfad die tenantlokale Sonderrolle `system_admin` oder die Plattformrolle `instance_registry_admin` prüft
- **THEN** darf das System diese technische Sonderrolle weiterhin gezielt in Keycloak abgleichen
- **AND** bleibt dieser Abgleich auf den jeweils zuständigen Realm-Scope beschränkt

### Requirement: Kanonische Session-Projektion trennt technische und fachliche Rollen
Das System SHALL für Session-, `/auth/me`- und Profilprojektionen zwischen rohen Keycloak-Rollen und der kanonischen fachlichen Rollen- und Permission-Sicht unterscheiden. Die kanonische Sicht umfasst direkte IAM-Rollen sowie implizite Rollenwirkung aus Gruppenzuordnungen.

#### Scenario: Tenant-Session nutzt kanonische Fachsicht
- **WHEN** ein Benutzer sich in einem Tenant-Realm erfolgreich anmeldet
- **THEN** enthält die fachliche Session-Projektion die kanonischen tenantlokalen Rollen und Permissions aus IAM
- **AND** enthält diese kanonische Sicht auch implizite Rollenwirkung aus IAM-Gruppenzuordnungen
- **AND** werden rohe Keycloak-Rollen in einem getrennten Rollenfeld bereitgestellt
- **AND** dienen rohe Keycloak-Rollen nicht direkt als normative Quelle für Tenant-UI oder Tenant-Gates

#### Scenario: `/auth/me` liefert beide Rollensichten explizit getrennt
- **WHEN** ein authentifizierter Tenant-Benutzer `/auth/me` aufruft
- **THEN** liefert die Antwort eine kanonische IAM-Rollensicht inklusive gruppenabgeleiteter Rollenwirkung
- **AND** liefert die Antwort zusätzlich die rohe Keycloak-Rollensicht als technische Interop- und Diagnoseinformation
- **AND** bleiben Autorisierungsentscheidungen auf die kanonische IAM-Sicht beschränkt

#### Scenario: Legacy-Keycloak-Rollen bleiben diagnostisch sichtbar
- **WHEN** ein Tenant-Benutzer noch historische Keycloak-Rollen besitzt, die nicht mehr Teil des Sollmodells sind
- **THEN** kann die Session- oder Diagnoseprojektion diese Rollen als Legacy- oder Rohdaten sichtbar machen
- **AND** wertet das System sie nicht automatisch als wirksame fachliche Tenant-Rollen

## MODIFIED Requirements
### Requirement: Keycloak Admin API Integration
Das System MUST über dedizierte Service-Accounts mit der Keycloak Admin REST API kommunizieren, um Benutzer, Identitätsattribute, technische Realm-Artefakte und die wenigen normativ verbleibenden Sonderrollen im jeweiligen Platform- oder Tenant-Scope zu verwalten. Keycloak bleibt System of Record für Identitäten, Login und technische Realm-Zugänge; tenantlokale Fachrollen und deren Permissions werden normativ im Studio-IAM-Modell verwaltet.

#### Scenario: Keycloak-first user mutation
- **WHEN** ein berechtigter Admin einen User im Studio erstellt, deaktiviert oder Identitäts-/Profilfelder ändert
- **THEN** führt das System die identitätsbezogene Mutation zuerst gegen Keycloak aus
- **AND** synchronisiert anschließend das Studio-Read-Model
- **AND** direkte fachliche Tenant-Rollen werden dabei nicht als allgemeiner Keycloak-Rollenkatalog vorausgesetzt
- **AND** bei nachgelagertem Sync-Fehler bleibt der Keycloak-Zustand sichtbar und wird als Drift gemeldet

#### Scenario: Tenant-Rollenmutation bleibt fachlich im IAM-Modell
- **WHEN** ein berechtigter Tenant-Admin eine fachliche Rolle oder deren Permissions ändert
- **THEN** führt das System die fachliche Mutation im IAM-Rollenmodell aus
- **AND** ein technischer Keycloak-Call ist nur dann erforderlich, wenn ausdrücklich eine verbleibende Sonderrolle betroffen ist

### Requirement: Keycloak User Synchronization Scope
The system SHALL run Keycloak user synchronization as a reconciliation flow that explains differences between Keycloak and Studio instead of hiding unmapped or partially failed objects. The synchronization scope focuses on identities, scope resolution, technical realm access markers, and explicitly managed Sonderrollen rather than treating arbitrary Keycloak role catalogs as the normative source of tenant authorization.

#### Scenario: Sync reports legacy role drift without reintroducing it
- **WHEN** ein User-Sync Keycloak-Rollen findet, die außerhalb des normativen Sonderrollenschnitts liegen
- **THEN** enthält der Sync-Report diese Rollen als Legacy-, Interop- oder Driftbefund
- **AND** das System projiziert sie nicht automatisch als kanonische tenantlokale Fachrollen

#### Scenario: Partial failure remains actionable
- **WHEN** ein Sync mit `partial_failure` endet
- **THEN** enthält der Report objektbezogene Ursachen wie `missing_instance_attribute`, `forbidden_role_mapping`, `read_only_federated_field` oder `idp_forbidden`
- **AND** Admins können daraus Reconcile- oder Runbook-Aktionen ableiten

## REMOVED Requirements
### Requirement: Studio-Rollen-Lebenszyklus mit Keycloak-Synchronisierung
**Reason**: Tenantlokale Fachrollen sollen nicht mehr allgemein als Keycloak-Realm-Rollen gespiegelt werden.
**Migration**: Rollen-CRUD für tenantlokale Custom-Rollen wird auf das IAM-Rollenmodell verlagert; nur technische Sonderrollen bleiben gezielt synchronisierbar.

### Requirement: Deterministisches Role-Mapping und Sync-Status
**Reason**: Ein allgemeines externes Keycloak-Mapping pro studioverwalteter Rolle ist nicht mehr Teil des Sollmodells.
**Migration**: Mapping- und Sync-Zustände bleiben nur dort erhalten, wo technische Sonderrollen oder explizite Interop-Artefakte weiterhin verwaltet werden.

### Requirement: Reconciliation für Rollen-Drift
**Reason**: Allgemeine Drift-Heilung zwischen IAM-Rollenbestand und Keycloak-Rollenbestand soll nicht mehr das tenantlokale Fachrollenmodell normieren.
**Migration**: Reconcile-Pfade werden auf Identitätsdrift, Sonderrollen und Legacy-Diagnose umgestellt; historische Keycloak-Rollen werden berichtet statt pauschal neu materialisiert.
