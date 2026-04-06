## MODIFIED Requirements
### Requirement: Mandanten- und Plattform-Scope werden getrennt modelliert

Das System MUST Tenant-Instanzen und den globalen Root-Host als getrennte fachliche Runtime-Scopes modellieren.

#### Scenario: Tenant-Request verwendet Instanz-Scope

- **WHEN** ein Request über eine Tenant-Subdomain eingeht
- **THEN** arbeitet der Runtime-Kontext mit `scope_kind=instance`
- **AND** `instanceId` verweist auf einen Eintrag in `iam.instances`

#### Scenario: Root-Host verwendet Plattform-Scope

- **WHEN** ein Request über den Root-Host der Plattform eingeht
- **THEN** arbeitet der Runtime-Kontext mit `scope_kind=platform`
- **AND** `instanceId` bleibt leer
- **AND** der Plattform-Scope wird nicht durch eine Pseudo-Instanz in `iam.instances` modelliert
