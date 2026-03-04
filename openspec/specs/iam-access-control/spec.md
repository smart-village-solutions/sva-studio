# iam-access-control Specification

## Purpose
Diese Spezifikation beschreibt die technischen und fachlichen Anforderungen an das IAM-Access-Control-Modul. Sie legt fest, wie nach erfolgreicher OIDC-Authentifizierung ein verlässlicher Identity-Kontext bereitgestellt wird, wie RBAC-Basisdaten instanzgebunden persistiert werden und wie die Abgrenzung zu nachgelagerten Autorisierungsentscheidungen in Child C/D erfolgt.
## Requirements
### Requirement: Authentifizierter Identity-Kontext als Vorbedingung

Das System MUST nach erfolgreicher OIDC-Authentifizierung einen verlässlichen Identity-Kontext bereitstellen, der in nachgelagerten Child-Changes für RBAC/ABAC verwendet werden kann.

#### Scenario: Identity-Kontext nach Login verfügbar

- **WHEN** ein Benutzer sich erfolgreich über Keycloak anmeldet
- **THEN** stehen mindestens `sub` (Identity-ID) und `instanceId` im Server-Kontext bereit
- **AND** dieser Kontext kann von nachgelagerten Autorisierungspfaden konsumiert werden

### Requirement: Keine fachliche Autorisierungsentscheidung in Child A

Das System MUST in Child A keine fachlichen RBAC-/ABAC-Entscheidungen implementieren; diese werden in Child C/D spezifiziert.

#### Scenario: Autorisierung außerhalb Child-A-Scope

- **WHEN** ein Fachmodul eine fachliche Berechtigungsentscheidung benötigt
- **THEN** ist Child A nicht die entscheidende Instanz
- **AND** die verbindliche Entscheidung erfolgt erst über die in Child C/D definierten Authorize-Pfade

### Requirement: Persistente RBAC-Basisdaten

Das System SHALL die für Autorisierung erforderlichen RBAC-Basisdaten (`roles`, `permissions`, Zuordnungen) konsistent und instanzgebunden persistieren.

#### Scenario: Rollenauflösung im Instanzkontext

- **WHEN** Rollen- und Permission-Zuordnungen für einen Benutzer abgefragt werden
- **THEN** werden ausschließlich Zuordnungen der aktiven `instanceId` berücksichtigt
- **AND** organisationsfremde Zuordnungen bleiben wirkungslos

### Requirement: Idempotente Initialisierung von Basisrollen

Das System SHALL Basisrollen und Permission-Zuordnungen idempotent initialisieren, damit wiederholte Deployments keine Dubletten erzeugen.

#### Scenario: Wiederholte Seed-Ausführung für Rollen

- **WHEN** Seed-Skripte mehrfach ausgeführt werden
- **THEN** existiert jede Basisrolle nur einmal
- **AND** Rollen-Permission-Beziehungen bleiben konsistent

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
