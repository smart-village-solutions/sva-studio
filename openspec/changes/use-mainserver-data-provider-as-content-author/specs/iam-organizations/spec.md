## ADDED Requirements

### Requirement: Organisationsrichtlinie begrenzt den Mainserver-Mutationsprincipal

Das IAM-System SHALL `content_author_policy` als serverseitige Begrenzung der für Mainserver-Content-Mutationen erlaubten Principal-Typen auswerten. Es SHALL ausschließlich die aktive, serverseitig bestätigte Organisation berücksichtigen und keine andere Membership, Client-ID oder Anzeigenangabe als Organisationsprincipal verwenden. Es SHALL dafür keine zusätzliche generische Berechtigung zum Handeln als Organisation verlangen; maßgeblich sind die fully-qualified Content-Action mit Scope, aktive Organisation, Membership, Richtlinie und Credential-Verfügbarkeit.

#### Scenario: Organisation erlaubt nur organisatorischen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** das Studio die verfügbaren Mutationsprincipals bestimmt
- **THEN** ist ausschließlich `organization` zulässig
- **AND** die Oberfläche bietet keinen persönlichen Principal an
- **AND** zeigt kein Principal-Dropdown

#### Scenario: Organisation erlaubt organisatorischen oder persönlichen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **WHEN** das Studio die verfügbaren Mutationsprincipals bestimmt
- **THEN** sind `organization` und `user` zulässig
- **AND** ist im Editor `organization` vorausgewählt und der Benutzer kann im Dropdown zu `user` wechseln
- **AND** die serverseitige Mutation validiert die Auswahl erneut

#### Scenario: Eigenständige Aktion verwendet die von der Richtlinie erzwungene Organisation

- **GIVEN** eine aktive Organisation ist serverseitig bestätigt
- **AND** sie hat `content_author_policy = 'org_only'`
- **AND** ein Benutzer löst eine Schreibaktion außerhalb eines geöffneten Editors aus einer Liste oder einem Dialog aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = organization`
- **AND** validiert der Server Content-Action, Scope, Membership, Richtlinie und Organisations-Credentials erneut

#### Scenario: Eigenständige Aktion ohne erzwungenen Organisationsprincipal verwendet den Account

- **GIVEN** keine aktive Organisation ist serverseitig bestätigt oder ihre Richtlinie ist nicht `org_only`
- **AND** ein Benutzer löst eine Schreibaktion außerhalb eines geöffneten Editors aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = user`
- **AND** validiert der Server Content-Action, Scope und persönliche Credentials erneut

#### Scenario: Andere Membership ersetzt die aktive Organisation nicht

- **GIVEN** ein Benutzer ist Mitglied mehrerer Organisationen
- **AND** genau eine Organisation ist im Session-Kontext aktiv
- **WHEN** der Benutzer `actingPrincipalType = organization` auswählt
- **THEN** verwendet das System ausschließlich die aktive Organisation
- **AND** durchsucht es keine anderen Memberships oder Default-Kontexte nach Credentials

#### Scenario: Kein aktiver Organisationskontext

- **GIVEN** für den authentifizierten Benutzer ist keine Organisation aktiv
- **WHEN** das Studio die verfügbaren Mutationsprincipals bestimmt
- **THEN** ist ausschließlich `user` auswählbar
- **AND** ein `organization`-Scope fällt für Content-Autorisierung auf `own` zurück
