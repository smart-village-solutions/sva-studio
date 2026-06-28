## ADDED Requirements

### Requirement: Mainserver-Projektion trennt Quellkontext von IAM-Ownership

Das System SHALL Mainserver-Quellkontext, DataProvider und externe Organisationswerte in der Studio-Projektion getrennt von kanonischer IAM-Ownership führen.

Ein Mainserver-DataProvider SHALL als externe Veröffentlichungsidentität behandelt werden, an der die verwendeten API-Credentials hängen. `ownerOrganizationId` SHALL nur gesetzt werden, wenn ein expliziter Studio-IAM-Owner bestimmt ist. Externe Mainserver-Organisationswerte, Credential-Kontext, DataProvider oder aktive Abfrageorganisationen SHALL nicht automatisch als IAM-Owner materialisiert werden.

#### Scenario: Externe Organisation wird als Quellmetadatum projiziert

- **GIVEN** ein Mainserver-Datensatz enthält eine externe Organisation oder einen DataProvider
- **WHEN** Studio den Datensatz in die Inhaltsliste projiziert
- **THEN** speichert die Projektion diesen Wert als Quell- oder Integrationsmetadatum
- **AND** setzt `ownerOrganizationId` nicht allein aufgrund dieses externen Werts

#### Scenario: DataProvider wird explizit auf Studio-Organisation gemappt

- **GIVEN** ein Mainserver-Datensatz enthält DataProvider `dp-1`
- **AND** Studio besitzt eine explizite Zuordnung von `dp-1` zu Studio-Organisation `org-1`
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt die Projektion `sourceDataProviderId` auf `dp-1`
- **AND** setzt `ownerOrganizationId` auf `org-1`
- **AND** dokumentiert die Ownership-Herleitung als explizites DataProvider-Mapping

#### Scenario: Persönlicher Credential-Fallback erzeugt keine Organisationsownership

- **GIVEN** ein Mainserver-Datensatz wurde über User-Fallback-Credentials erzeugt
- **AND** der resultierende DataProvider ist nicht explizit einer Studio-Organisation zugeordnet
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt die Projektion keine Organisationsownership aus dem aktiven Organisationskontext
- **AND** setzt höchstens eine explizit herleitbare User-Ownership

#### Scenario: Expliziter IAM-Owner ist vorhanden

- **GIVEN** ein Mainserver-Datensatz ist einem kanonischen Studio-IAM-Owner explizit zugeordnet
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt die Projektion `ownerUserId` oder `ownerOrganizationId` aus dieser kanonischen Zuordnung
- **AND** Sichtbarkeitsentscheidungen verwenden danach die normale IAM-Authorization-Engine

#### Scenario: Ownerloser Mainserver-Datensatz bleibt fail-closed

- **GIVEN** ein Mainserver-Datensatz besitzt keinen kanonischen Studio-IAM-Owner
- **WHEN** ein Benutzer mit nur `own`- oder `organization`-Scope die Inhaltsliste lädt
- **THEN** ist der Datensatz nicht aufgrund externer Organisationsmetadaten sichtbar
- **AND** Sichtbarkeit erfordert eine passende globale Berechtigung oder eine spätere explizite Ownership-Zuordnung

### Requirement: Mainserver-Mutationen verwenden expliziten Organisations- oder Benutzerkontext

Das System SHALL schreibende Mainserver-Mutationen für Benutzer mit mehreren Organisationsmitgliedschaften in einem expliziten Mutationskontext ausführen. Eine Mutation SHALL entweder im Modus `organization` mit validierter `activeOrganizationId` oder im Modus `user` mit persönlicher Credential-Quelle laufen.

Listenfilter, Mainserver-DataProvider, externe Organisationswerte oder vorherige UI-Auswahlen SHALL die aktive Organisation nicht implizit ersetzen.

#### Scenario: Benutzer legt Datensatz im Namen einer aktiven Organisation an

- **GIVEN** ein Benutzer ist Mitglied in Organisation `org-1` und `org-2`
- **AND** die Session enthält `activeOrganizationId = org-2`
- **AND** Organisation `org-2` besitzt vollständige Mainserver-Credentials
- **WHEN** der Benutzer einen Mainserver-gestützten Inhalt im Organisationsmodus anlegt
- **THEN** verwendet das System ausschließlich die Credentials von `org-2`
- **AND** setzt `ownerOrganizationId` auf `org-2`
- **AND** speichert den resultierenden Mainserver-DataProvider als externe Quellidentität

#### Scenario: Aktive Organisation fehlt bei Organisationsmutation

- **GIVEN** ein Benutzer ist Mitglied in mehreren Organisationen
- **AND** die Mutation verlangt Organisationsmodus
- **AND** der Request enthält keine validierte `activeOrganizationId`
- **WHEN** die Mutation ausgeführt werden soll
- **THEN** weist das System die Mutation vor dem Mainserver-Aufruf ab
- **AND** es errät keine Organisation aus DataProvider, Listenfilter oder früherer Auswahl

#### Scenario: Persönliche Mutation bleibt persönlich

- **GIVEN** ein Benutzer ist Mitglied in mehreren Organisationen
- **AND** die Mutation läuft explizit im Modus `user`
- **WHEN** das System User-Fallback-Credentials verwendet
- **THEN** setzt das System keine Organisationsownership aus einer aktiven oder früher aktiven Organisation
- **AND** speichert `credentialSource = user` oder eine äquivalente Credential-Herkunft
