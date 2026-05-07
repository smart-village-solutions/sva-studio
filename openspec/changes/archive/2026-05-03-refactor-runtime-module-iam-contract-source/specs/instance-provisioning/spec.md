## ADDED Requirements
### Requirement: Runtime und Provisioning nutzen eine gemeinsame Modul-IAM-Vertragsquelle

Das System SHALL fuer modulbezogene IAM-Ableitungen in Runtime, Provisioning und Instanzdiagnostik eine gemeinsame, framework-agnostische Vertragsquelle verwenden.

#### Scenario: Runtime-Seeding liest keine manuelle Parallel-Registry mehr

- **WHEN** die Runtime den Sollzustand fuer modulbezogene Permissions und Systemrollen ableitet
- **THEN** liest sie die benoetigten Modul-IAM-Vertraege aus einer gemeinsamen kanonischen Vertragsquelle
- **AND** verwendet keine separat in `auth-runtime` gepflegte manuelle Modul-Registry

#### Scenario: Serverseitiger Vertragskonsum bleibt UI-unabhaengig

- **WHEN** ein serverseitiger Pfad Modul-IAM-Vertraege konsumiert
- **THEN** haengt dieser Pfad nicht von React-Komponenten, Host-Bindings oder UI-spezifischen Plugin-Importen ab
- **AND** bleibt der Vertrag fuer Node-ESM und Workspace-Runtime sauber konsumierbar

## MODIFIED Requirements
### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen ueber einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben und Teilfehler kontrolliert behandelt. Soweit der Workflow modulbezogene IAM-Basisartefakte oder deren Reparatur ableitet, verwendet er dafuer dieselbe gemeinsame Modul-IAM-Vertragsquelle wie Runtime und Diagnose.

#### Scenario: Erfolgreiche Neuanlage einer Instanz

- **WHEN** eine berechtigte Person eine neue Instanz mit gueltiger `instanceId` und gueltigem Ziel-Hostname anfordert
- **THEN** legt das System einen Provisioning-Lauf an
- **AND** erstellt oder reserviert die benoetigten Registry- und Basis-Konfigurationsartefakte
- **AND** erzeugt oder validiert getrennt den Login-Client `authClientId` und den Tenant-Admin-Client `tenantAdminClient.clientId`
- **AND** dokumentiert den Uebergang bis zum Status `active`

#### Scenario: Modulbezogene IAM-Basis wird aus derselben Vertragsquelle repariert

- **WHEN** ein Provisioning-, Repair- oder Reseed-Pfad modulbezogene IAM-Artefakte einer Instanz auf Sollstand bringt
- **THEN** verwendet dieser Pfad dieselbe gemeinsame Modul-IAM-Vertragsquelle wie Runtime und Access-Control
- **AND** koennen Plugin-Vertragsaenderungen nicht stillschweigend nur im UI- oder nur im Runtime-Pfad wirksam werden
