# IAM Access Control Specification Delta

## ADDED Requirements

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

### Requirement: Instanzzentriertes Scoping in RBAC v1

Das System SHALL `instanceId` als primären Scoping-Filter für RBAC-Entscheidungen erzwingen und organisationsspezifischen Kontext innerhalb der Instanz auswerten.

#### Scenario: Zugriff außerhalb der aktiven Instanz

- **WHEN** ein Benutzerkontext für `instanceId=A` aktiv ist
- **AND** eine Berechtigungsprüfung Ressourcen von `instanceId=B` adressiert
- **THEN** wird der Zugriff verweigert
- **AND** ein passender Denial-Reason wird zurückgegeben

### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen.

#### Scenario: Laden der effektiven Berechtigungen

- **WHEN** `GET /iam/me/permissions` im aktiven Instanzkontext aufgerufen wird
- **THEN** werden die effektiven RBAC-Berechtigungen für diesen Kontext zurückgegeben
- **AND** organisationsspezifische Einschränkungen werden berücksichtigt

### Requirement: RBAC-v1-Baseline-Performance

Das System SHALL die Baseline-Performance von `POST /iam/authorize` messen und dokumentieren.

#### Scenario: Baseline-Messung

- **WHEN** die RBAC-v1-Implementierung getestet wird
- **THEN** wird die P95-Latenz für `authorize` erhoben
- **AND** die Ergebnisse werden als Referenz für nachfolgende Optimierungen dokumentiert

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
