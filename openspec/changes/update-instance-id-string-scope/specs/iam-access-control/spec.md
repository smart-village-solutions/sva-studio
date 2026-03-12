## MODIFIED Requirements
### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert.

#### Scenario: Request-Input wird schema-validiert

- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** `instanceId` wird als getrimmter, nicht-leerer String akzeptiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

### Requirement: Instanzzentriertes Scoping in RBAC v1

Das System SHALL `instanceId` als primären Scoping-Filter für RBAC-Entscheidungen erzwingen und organisationsspezifischen Kontext innerhalb der Instanz auswerten.

#### Scenario: Zugriff außerhalb der aktiven Instanz

- **WHEN** ein Benutzerkontext für `instanceId=A` aktiv ist
- **AND** eine Berechtigungsprüfung Ressourcen von `instanceId=B` adressiert
- **THEN** wird der Zugriff verweigert
- **AND** die Prüfung basiert auf String-Gleichheit des fachlichen Instanzschlüssels
