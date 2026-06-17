## MODIFIED Requirements

### Requirement: Studio-Rollen-Lebenszyklus mit Keycloak-Synchronisierung

Das System MUST Rollen-CRUD aus dem Studio mit Keycloak Realm Roles synchronisieren, sodass für studioverwaltete Rollen keine manuelle Keycloak-Pflege erforderlich ist.

#### Scenario: Custom-Rolle erstellen

- **WHEN** ein `system_admin` eine neue Custom-Rolle im Studio erstellt
- **THEN** wird die Rolle in Keycloak als Realm Role angelegt
- **AND** danach wird die Rolle in `iam.roles` persistiert
- **AND** die API-Antwort enthält `syncState = "synced"`

#### Scenario: Custom-Rolle aktualisieren

- **WHEN** ein `system_admin` eine bestehende Custom-Rolle aktualisiert
- **THEN** werden die relevanten Metadaten in Keycloak und IAM-Datenbank konsistent aktualisiert
- **AND** die Antwort enthält den finalen Synchronisierungsstatus

#### Scenario: Custom-Rolle löschen

- **WHEN** ein `system_admin` eine löschbare Custom-Rolle entfernt
- **THEN** werden vor dem eigentlichen Rollen-Delete alle direkten Benutzerzuordnungen in `iam.account_roles` dieser Rolle entfernt
- **AND** werden vor dem eigentlichen Rollen-Delete alle Gruppenzuordnungen in `iam.group_roles` dieser Rolle entfernt
- **AND** die zugehörige Keycloak-Rolle wird entfernt
- **AND** das Mapping wird aus dem IAM-Speicher gelöscht
