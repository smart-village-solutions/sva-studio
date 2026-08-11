## ADDED Requirements

### Requirement: Technische Account-Klassifikation ist administrativ und nebenwirkungsfrei

Das System SHALL Tenant-Accounts mit dem booleschen, lokal persistierten Merkmal `isTechnicalAccount` klassifizieren können. Das Merkmal SHALL bei neuen und bestehenden Accounts über die bestehende autorisierte Account-Erstellung beziehungsweise Account-Bearbeitung änderbar sein. Seine Änderung SHALL keine automatische Änderung anderer Identitäts-, Zugangs- oder Berechtigungsmerkmale auslösen.

#### Scenario: Administrator markiert einen bestehenden Account als technisch

- **WHEN** ein zur Account-Bearbeitung berechtigter Administrator `isTechnicalAccount = true` speichert
- **THEN** persistiert das System die technische Klassifikation
- **AND** bleiben Keycloak-Status, Anmeldefähigkeit, Rollen, Gruppen, Memberships, Einladungszustand und Mainserver-Credentials unverändert
- **AND** wird keine Organisations-Provisionierung allein durch das Flag ausgelöst

#### Scenario: Administrator entfernt die technische Klassifikation

- **WHEN** ein zur Account-Bearbeitung berechtigter Administrator `isTechnicalAccount = false` speichert
- **THEN** persistiert das System die nicht technische Klassifikation
- **AND** bleiben alle anderen Accountfelder und eine gegebenenfalls vorhandene Organisationszuordnung unverändert
- **AND** wird kein früherer Lifecycle-Zustand automatisch wiederhergestellt

#### Scenario: Bestandsaccount hat keine explizite technische Klassifikation

- **WHEN** ein vor Einführung des Merkmals bestehender Studioaccount oder ein noch nicht lokal gemappter Keycloak-Benutzer gelesen wird
- **THEN** behandelt das System ihn als `isTechnicalAccount = false`
- **AND** überschreibt ein Keycloak-Import keine bereits lokal gespeicherte technische Klassifikation

#### Scenario: Normale Accounterstellung behält ihr bestehendes Provisioning-Verhalten

- **WHEN** ein Administrator über den normalen Accountpfad einen Account mit `isTechnicalAccount = true` erstellt
- **THEN** löst das Flag kein Organisations-Provisioning aus
- **AND** unterdrückt es nicht das unabhängig vom Flag bestehende persönliche Mainserver-Provisioning des normalen Accountpfads
- **AND** bleiben beide Provisioning-Verträge fachlich getrennt
