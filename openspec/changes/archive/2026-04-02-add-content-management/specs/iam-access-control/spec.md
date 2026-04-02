## ADDED Requirements

### Requirement: Rollenbasierte Autorisierung für Inhaltsverwaltung

Das System SHALL die Inhaltsverwaltung über die zentrale IAM-Autorisierung absichern.

#### Scenario: Zugriff auf Inhaltsliste ohne Leserecht

- **WHEN** ein Benutzer die Seite `Inhalte` oder eine Inhaltsdetailseite aufruft
- **AND** ihm im aktiven Kontext die Berechtigung `content.read` fehlt
- **THEN** verweigert das System den Zugriff
- **AND** es werden keine Inhaltsdaten offengelegt

#### Scenario: Read-only-Zugriff auf Inhalte

- **WHEN** ein Benutzer `content.read`, aber keine schreibenden Inhaltsrechte besitzt
- **THEN** kann er Liste, Detailansicht und freigegebene Historie lesen
- **AND** Erstellungs-, Bearbeitungs- und Statuswechselaktionen bleiben gesperrt

#### Scenario: Statuswechsel erfordert passende Fachberechtigung

- **WHEN** ein Benutzer den Status eines Inhalts ändern will
- **THEN** prüft das System die dazu passende Inhaltsberechtigung wie `content.submit_review`, `content.approve`, `content.publish` oder `content.archive`
- **AND** ein unzulässiger Statuswechsel wird serverseitig abgewiesen

#### Scenario: Inhaltsrechte werden im aktiven Scope ausgewertet

- **WHEN** eine Berechtigungsprüfung für Inhaltsverwaltung erfolgt
- **THEN** wertet das System die Rechte im aktiven `instanceId`- und Organisationskontext aus
- **AND** Rechte aus fremden Instanzen oder unzulässigen Organisationskontexten bleiben wirkungslos

