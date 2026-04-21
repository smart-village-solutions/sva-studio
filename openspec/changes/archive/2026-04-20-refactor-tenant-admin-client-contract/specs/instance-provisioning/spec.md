## MODIFIED Requirements

### Requirement: Zentrale Instanz-Registry

Das System SHALL eine zentrale Registry für Studio-Instanzen bereitstellen, die Tenant-Identität, Hostnamen, Lebenszyklusstatus und Basis-Konfiguration führt.

#### Scenario: Aktive Instanz ist in der Registry beschrieben

- **WHEN** eine Studio-Instanz produktiv erreichbar sein soll
- **THEN** existiert ein Registry-Eintrag mit `instanceId`, `status`, `primaryHostname` und den benötigten Basis-Metadaten
- **AND** enthält der Auth-Vertrag mindestens `authRealm`, `authClientId` und `tenantAdminClient`
- **AND** kann die Runtime daraus Tenant-Kontext, Login-Konfiguration und Tenant-Admin-Konfiguration getrennt ableiten

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen über einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben und Teilfehler kontrolliert behandelt.

#### Scenario: Erfolgreiche Neuanlage einer Instanz

- **WHEN** eine berechtigte Person eine neue Instanz mit gültiger `instanceId` und gültigem Ziel-Hostname anfordert
- **THEN** legt das System einen Provisioning-Lauf an
- **AND** erstellt oder reserviert die benötigten Registry- und Basis-Konfigurationsartefakte
- **AND** erzeugt oder validiert getrennt den Login-Client `authClientId` und den Tenant-Admin-Client `tenantAdminClient.clientId`
- **AND** dokumentiert den Übergang bis zum Status `active`

### Requirement: Administrativer Steuerungspfad für neue Instanzen

Das System SHALL einen administrativen Steuerungspfad für die Anlage und Verwaltung neuer Instanzen bereitstellen.

#### Scenario: Instanzanlage über Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** verwendet die UI denselben fachlichen Provisioning-Pfad wie automatisierte oder CLI-basierte Prozesse
- **AND** validiert `instanceId`, Hostname und Pflichtkonfiguration vor dem Start
- **AND** validiert der Pfad getrennt die Pflichtfelder für Login-Client und Tenant-Admin-Client
- **AND** ist der Zugriff auf dedizierte Admin-Rollen mit Least-Privilege begrenzt
- **AND** erfordern kritische Mutationen eine frische Re-Authentisierung

## ADDED Requirements

### Requirement: Getrennter Tenant-Admin-Client-Vertrag pro Instanz

Das System SHALL pro Instanz einen separaten technischen Vertrag für den tenant-lokalen Admin-Client führen.

#### Scenario: Registry beschreibt Login- und Admin-Client getrennt

- **WHEN** eine Instanz gelesen oder aktualisiert wird
- **THEN** enthält der Instanzvertrag `authClientId` für den interaktiven Login-Pfad
- **AND** enthält er zusätzlich `tenantAdminClient.clientId`
- **AND** enthält `tenantAdminClient` mindestens den Secret-Status
- **AND** bleibt das zugehörige Secret write-only

#### Scenario: Tenant-Admin-Client fehlt bei betriebsfähiger Tenant-Administration

- **WHEN** eine Instanz keinen vollständigen `tenantAdminClient` besitzt
- **THEN** markieren Preflight, Doctor oder Status diesen Zustand als `warning` oder `blocked`
- **AND** normale Tenant-Admin-Mutationen werden nicht freigeschaltet

### Requirement: Provisioning prüft Login-Client und Tenant-Admin-Client getrennt

Das System SHALL Login-Client und Tenant-Admin-Client im Provisioning und Reconcile getrennt prüfen und ausweisen.

#### Scenario: Preflight weist getrennte Client-Artefakte aus

- **WHEN** ein Preflight oder Statuslauf für eine Instanz ausgeführt wird
- **THEN** enthält die Checkliste getrennte Einträge für Login-Client und Tenant-Admin-Client
- **AND** zeigen Details Realm, Client-ID, Secret-Status und Drift je Artefakt getrennt

#### Scenario: Provisioning erzeugt fehlenden Tenant-Admin-Client nach

- **WHEN** Realm und Login-Client existieren, der Tenant-Admin-Client aber fehlt
- **THEN** darf der Provisioning-Lauf genau diesen Client idempotent nachziehen
- **AND** bleibt der Lauf auditierbar und deterministisch wiederholbar
