## MODIFIED Requirements

### Requirement: Plattformrollen und Tenant-Admin-Rollen bleiben getrennt

Das System SHALL tenant-lokale Admin-Rollen und globale Plattformrollen in der Instanzverwaltung strikt trennen.

#### Scenario: Nur Plattform-Admin darf Keycloak-Provisioning anstossen

- **WHEN** ein Benutzer ohne `instance_registry_admin` versucht, Instanz-Realm-Grundeinstellungen zu ändern oder ein Keycloak-Provisioning auszulösen
- **THEN** lehnt das System die Operation ab

#### Scenario: Technischer Keycloak-Zugang blockiert fehlende Rechte vor dem Lauf

- **WHEN** der technische Keycloak-Admin-Zugang den Ziel-Realm nicht verwalten kann
- **THEN** markiert der Preflight die Ausführung als blockiert
- **AND** wird getrennt ausgewiesen, ob der Plattformpfad oder der Tenant-Admin-Client betroffen ist
- **AND** es wird kein Keycloak-Mutationslauf gestartet

## ADDED Requirements

### Requirement: Normale Tenant-Admin-Mutationen nutzen ausschließlich den Tenant-Admin-Client

Das System SHALL normale Tenant-Admin-Mutationen ausschließlich über den tenantlokalen Admin-Client der aktiven Instanz ausführen.

#### Scenario: Tenant-User-CRUD löst Tenant-Admin-Client auf

- **WHEN** innerhalb eines Tenant-Hosts Nutzer, Rollen, Gruppen oder Zuordnungen geändert werden
- **THEN** löst der Server Realm und Client aus `iam.instances.authRealm` und `iam.instances.tenantAdminClient`
- **AND** verwendet keinen globalen Plattform-Admin-Client als stillen Fallback

#### Scenario: Tenant-Admin-Client ist nicht konfiguriert

- **WHEN** eine normale Tenant-Mutation ausgeführt werden soll, aber `tenantAdminClient` fehlt oder unvollständig ist
- **THEN** lehnt das System die Mutation fail-closed ab
- **AND** liefert einen strukturierten Fehler wie `tenant_admin_not_configured`
- **AND** leitet die Operation nicht implizit auf den Plattformpfad um

### Requirement: Login-Client und Tenant-Admin-Client bleiben diagnostisch getrennt

Das System SHALL Login-Pfad, Tenant-Admin-Pfad und Plattformpfad in Diagnosen und Health-Antworten getrennt ausweisen.

#### Scenario: Tenant-Health zeigt getrennte Auth-Artefakte

- **WHEN** Health-, Doctor- oder Diagnoseinformationen für eine Tenant-Instanz abgefragt werden
- **THEN** enthalten sie mindestens den Login-Realm, den Login-Client, den Tenant-Admin-Realm und den Tenant-Admin-Client
- **AND** weisen sie den verwendeten `executionMode` und die `resolutionSource` aus

#### Scenario: Break-Glass bleibt expliziter Sonderpfad

- **WHEN** eine Plattform- oder Break-Glass-Operation tenant-interne Daten ändern darf
- **THEN** ist dieser Modus technisch und auditierbar als `break_glass` oder `platform_admin` gekennzeichnet
- **AND** wird nicht als Normalpfad für Tenant-Admin-Screens verwendet
