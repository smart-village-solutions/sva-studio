## MODIFIED Requirements
### Requirement: User-Anlage in Studio und Keycloak

Das System SHALL Benutzerkonten konsistent zwischen IAM und Keycloak halten.

#### Scenario: Benutzer im Studio anlegen

- **WENN** ein Administrator im Studio einen Benutzer anlegt
- **DANN** wird der User zuerst in Keycloak via `POST /admin/realms/{realm}/users` erstellt
- **UND** anschließend in `iam.accounts` und `iam.instance_memberships` persistiert
- **UND** Rollen werden nach erfolgreicher Persistenz mit Keycloak synchronisiert

#### Scenario: Benutzer aus Keycloak nach IAM importieren

- **WENN** ein Administrator einen Keycloak-Sync für eine Instanz ausführt
- **DANN** werden nur Keycloak-Benutzer mit passendem `instanceId`-Attribut importiert oder aktualisiert
- **UND** Basisdaten wie Benutzername, E-Mail, Vorname, Nachname, Anzeigename und Aktivstatus werden in `iam.accounts` gespiegelt
- **UND** fehlende `iam.instance_memberships` werden angelegt
- **UND** bestehende IAM-Benutzer werden nicht dupliziert
