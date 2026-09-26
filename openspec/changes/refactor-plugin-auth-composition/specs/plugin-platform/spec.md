## ADDED Requirements

### Requirement: Account-Create-Beiträge werden nur aus der installierten Distribution gebunden

Das System SHALL plugin-eigene Account-Create-Attribute ausschließlich über
einen an der Composition-Root gebundenen, typisierten Beitrag aus der
installierten Distribution ableiten. Gemeinsame Auth-Runtime-Pfade MUST ohne
Runtime-Import eines konkreten Plugins ausführbar bleiben.

#### Scenario: Standard-Studio ohne SSF

- **GIVEN** das Studio-Artefakt enthält kein SSF-Plugin
- **WHEN** ein Core-Account angelegt wird
- **THEN** funktioniert die Benutzeranlage ohne SSF-Runtime-Paket
- **AND** es werden keine SSF-Claims an Keycloak übergeben

#### Scenario: SSF-Distribution mit bereitem Tenant

- **GIVEN** die SSF-Distribution bindet den SSF-Account-Create-Beitrag
- **AND** der SSF-Tenant ist aktiviert und revisionsgleich bereit
- **WHEN** ein berechtigter Account angelegt wird
- **THEN** entstehen die SSF-Claims vor dem erfolgreichen Create-Abschluss
- **AND** der Beitrag verwendet die tenantgebundene Projektionssperre

#### Scenario: Aktiver SSF-Tenant ohne bestätigte Readiness

- **GIVEN** SSF ist installiert und für den Tenant aktiviert
- **AND** Readiness oder Projektionsrevision ist nicht bestätigt
- **WHEN** ein Account angelegt werden soll
- **THEN** scheitert die Anlage vor dem Keycloak-Write mit dem bestehenden Konfliktvertrag
