## ADDED Requirements

### Requirement: Tenant-IAM besitzt nur lesenden Clientzugriff

Das System SHALL der tenantgebundenen IAM-Serviceidentität genau den für ihre nicht-destruktiven IAM- und Diagnoseaufgaben erforderlichen Clientzugriff gewähren und Clientmutationen ausschließlich der Provisioning-Serviceidentität vorbehalten.

#### Scenario: Tenant-IAM-Rollenvertrag ist minimal und explizit

- **WHEN** das Studio den Keycloak-Service-Account für Tenant-IAM provisioniert oder abgleicht
- **THEN** enthält dessen Sollvertrag `view-clients`
- **AND** enthält dessen Sollvertrag kein `manage-clients`
- **AND** werden weitergehende Rollen nicht als gleichwertiger Ersatz für den minimalen Sollvertrag akzeptiert

#### Scenario: Tenant-IAM liest den konfigurierten Login-Client

- **WHEN** eine explizite Tenant-IAM-Rechteprobe Clientmetadaten für den konfigurierten Login-Client benötigt
- **THEN** verwendet sie ausschließlich die tenantgebundene IAM-Serviceidentität des Ziel-Tenants
- **AND** führt sie nur nicht-destruktive Leseoperationen aus

#### Scenario: Tenant-IAM darf Clients nicht verändern

- **WHEN** die Tenant-IAM-Serviceidentität versucht, einen Client anzulegen, zu ändern, zu löschen oder dessen Secret zu rotieren
- **THEN** verweigert Keycloak die Operation
- **AND** verwendet das Studio für eine solche fachlich autorisierte Operation ausschließlich die Provisioning-Serviceidentität

#### Scenario: Fehlende Tenant-IAM-Credentials führen nicht zum Provisioner-Fallback

- **WHEN** die tenantgebundene IAM-Serviceidentität fehlt oder nicht verwendbar ist
- **THEN** schlägt die Tenant-IAM-Probe mit einem stabilen, nicht-sensitiven Befund fehl
- **AND** wiederholt das System die Probe nicht stillschweigend mit Provisioner-Credentials
