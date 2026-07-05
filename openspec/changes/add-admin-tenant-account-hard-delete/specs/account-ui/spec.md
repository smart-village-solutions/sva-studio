## ADDED Requirements

### Requirement: Benutzerverwaltung bietet eine privilegierte Löschaktion für Tenant-Accounts

Das System MUST in der Tenant-Benutzerverwaltung eine explizite Löschaktion für Tenant-Accounts bereitstellen, wenn der aktuelle Actor die Permission `iam.accounts.delete` effektiv besitzt.

#### Scenario: Löschaktion ist für berechtigte Administratoren verfügbar

- **WENN** ein berechtigter Tenant-Administrator einen löschbaren Tenant-Account in der Benutzerverwaltung betrachtet
- **DANN** zeigt die UI eine explizite Löschaktion
- **UND** erklärt ein Bestätigungsdialog die physische Löschung des Tenant-Accounts, die Entfernung in Keycloak und die inhaltsbezogene Behandlung nach wirksamer Tenant-/Account-Regel

#### Scenario: Geschützte Zielaccounts zeigen keinen irreführenden Delete-Flow

- **WENN** ein Zielaccount aktuell die Rolle `system_admin` besitzt
- **DANN** blendet die UI die Löschaktion aus oder deaktiviert sie mit klarer Begründung
- **UND** suggeriert die Oberfläche keinen unmittelbar ausführbaren Delete-Flow

#### Scenario: Unberechtigter Administrator sieht keine Löschaktion

- **WENN** ein Administrator die Permission `iam.accounts.delete` nicht effektiv besitzt
- **DANN** zeigt die UI keine ausführbare Löschaktion für Tenant-Accounts
- **UND** werden keine sensitiven Delete-Folgen oder Bestätigungsdialoge unnötig exponiert
