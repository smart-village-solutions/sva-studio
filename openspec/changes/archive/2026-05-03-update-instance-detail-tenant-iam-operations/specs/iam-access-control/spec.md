## MODIFIED Requirements
### Requirement: Normale Tenant-Admin-Mutationen nutzen ausschließlich den Tenant-Admin-Client

Das System SHALL normale Tenant-Admin-Mutationen ausschließlich über den tenantlokalen Admin-Client der aktiven Instanz ausführen.

#### Scenario: Tenant-User-CRUD löst Tenant-Admin-Client auf

- **WHEN** innerhalb eines Tenant-Hosts Nutzer, Rollen, Gruppen oder Zuordnungen geändert werden
- **THEN** löst der Server Realm und Client aus `iam.instances.authRealm` und `iam.instances.tenantAdminClient`
- **AND** verwendet keinen globalen Plattform-Admin-Client als stillen Fallback

#### Scenario: Tenant-Admin-Client ist nicht konfiguriert

- **WHEN** eine normale Tenant-Mutation ausgeführt werden soll, aber `tenantAdminClient` fehlt oder unvollständig ist
- **THEN** lehnt das System die Mutation fail-closed ab
- **AND** liefert einen strukturierten Fehler wie `tenant_admin_client_not_configured`
- **AND** leitet die Operation nicht implizit auf den Plattformpfad um

#### Scenario: Tenant-Reconcile bleibt tenantlokal

- **WHEN** ein `system_admin` für eine konkrete Instanz einen normalen Tenant-Rollenabgleich ausführt
- **THEN** verwendet der Server ausschließlich den tenantlokalen Admin-Client der Zielinstanz
- **AND** behandelt fehlende Rechte, fehlende Secrets oder falsche Realm-/Client-Zuordnung als Tenant-IAM-Befund
- **AND** wiederholt die Operation nicht mit Plattform- oder globalen Admin-Rechten
