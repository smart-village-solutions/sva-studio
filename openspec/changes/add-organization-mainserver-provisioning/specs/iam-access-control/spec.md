## ADDED Requirements

### Requirement: Organisations-Schreibrecht umfasst die eng begrenzte technische Provisioning-Identität

Das System SHALL `iam.org.write` als ausreichende Studio-Berechtigung für automatische und explizite Organisations-Provisionierung verwenden. Die Berechtigung SHALL die intern notwendige Erzeugung eines fest definierten technischen Accounts für genau diese Organisation umfassen, aber keine allgemeine Account-Create-Berechtigung verleihen.

#### Scenario: Organisationsadministrator provisioniert ohne allgemeines Account-Schreibrecht

- **GIVEN** ein Administrator besitzt `iam.org.write`, aber nicht `iam.user.write`
- **WHEN** er eine Organisation erstellt oder deren explizite Mainserver-Provisionierung auslöst
- **THEN** darf Studio den fest definierten technischen Organisationsaccount intern erzeugen oder wiederverwenden
- **AND** benötigt die Organisationsaktion kein zusätzliches `iam.user.write`

#### Scenario: Organisationsrequest kann keine freien Accountattribute zuweisen

- **WHEN** ein Benutzer eine Organisation erstellt oder nachprovisioniert
- **THEN** akzeptiert der Vertrag keine Rollen, Gruppen, Einladungseinstellungen oder frei wählbaren Accountattribute für die technische Identität
- **AND** erhält der Benutzer durch `iam.org.write` keine Berechtigung zum Aufruf der normalen Account-Erstellung

#### Scenario: Normale Accountbearbeitung bleibt getrennt geschützt

- **GIVEN** ein technischer Organisationsaccount wurde intern erzeugt
- **WHEN** ein Administrator ihn später über die normale Accountverwaltung bearbeiten möchte
- **THEN** gelten unverändert die normalen Account-Permissions
- **AND** erweitert die Organisationszuordnung diese Permissions nicht
