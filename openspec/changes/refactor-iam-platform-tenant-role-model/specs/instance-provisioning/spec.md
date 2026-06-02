## ADDED Requirements
### Requirement: Tenant-Admin-Bootstrap vergibt nur tenantlokale Sonderrechte
Das System SHALL beim Bootstrap einer neuen Instanz dem initialen Tenant-Admin ausschließlich tenantlokale Sonderrechte des Tenant-Realm zuweisen.

#### Scenario: Bootstrap vergibt system_admin, aber keine Plattformrolle
- **WHEN** der initiale Tenant-Admin einer neuen Instanz angelegt oder aktualisiert wird
- **THEN** synchronisiert das System im Tenant-Realm mindestens die Rolle `system_admin`
- **AND** es synchronisiert dabei nicht die Plattformrolle `instance_registry_admin`

#### Scenario: Tenant-Status fordert keine Plattformrolle im Tenant-Realm
- **WHEN** der Keycloak-Status oder Preflight einer Tenant-Instanz gelesen wird
- **THEN** bewertet das System tenantlokale Rollen und Tenant-Admin-Zustand ohne Erwartung einer Rolle `instance_registry_admin` im Tenant-Realm
- **AND** fehlende Plattformrollen im Tenant-Realm werden nicht als Drift des Tenant-Realm interpretiert

### Requirement: Root- und Tenant-Provisioning-Evidenz bleiben getrennt
Das System SHALL Provisioning-, Status- und Diagnosepfade für Root-Control-Plane und Tenant-Realm getrennt ausweisen.

#### Scenario: Root- und Tenant-Befunde bleiben semantisch getrennt
- **WHEN** eine Instanz im Root-Control-Plane-Cockpit betrachtet wird
- **THEN** bleiben Plattformzugang, Root-Operator-Rechte und tenantlokale Realm-Befunde als getrennte Achsen oder Diagnosen modelliert
- **AND** ein tenantlokaler Rollenfehler wird nicht als Root-Realm-Problem dargestellt

## MODIFIED Requirements
### Requirement: Getrennter Tenant-Admin-Client-Vertrag pro Instanz
Das System SHALL pro Instanz einen separaten technischen Vertrag für den tenant-lokalen Admin-Client führen. Dieser Vertrag verwaltet tenantlokale IAM-Operationen im Tenant-Realm und setzt keine Plattformrolle `instance_registry_admin` im Tenant-Realm voraus.

#### Scenario: Registry beschreibt Login- und Admin-Client getrennt
- **WHEN** eine Instanz gelesen oder aktualisiert wird
- **THEN** enthält der Instanzvertrag `authClientId` für den interaktiven Login-Pfad
- **AND** enthält er zusätzlich `tenantAdminClient.clientId`
- **AND** bleibt der Tenant-Admin-Client auf tenantlokale IAM-Operationen des Tenant-Realm beschränkt

#### Scenario: Tenant-Admin-Client fehlt bei betriebsfähiger Tenant-Administration
- **WHEN** eine Instanz keinen vollständigen `tenantAdminClient` besitzt
- **THEN** markieren Preflight, Doctor oder Status diesen Zustand als `warning` oder `blocked`
- **AND** normale Tenant-Admin-Mutationen werden nicht freigeschaltet
- **AND** der Fehler bezieht sich auf tenantlokale IAM-Betriebsfähigkeit, nicht auf Root-Plattformrollen
