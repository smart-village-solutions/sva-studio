## ADDED Requirements

### Requirement: Organisationsrichtlinie begrenzt den Mainserver-Erstellungsprincipal

Das IAM-System SHALL `content_author_policy` als serverseitige Begrenzung der beim Mainserver-Content-Create erlaubten Eigentümer-Principals auswerten. Es SHALL ausschließlich die aktive, serverseitig bestätigte Organisation berücksichtigen und keine andere Membership, Client-ID oder Anzeigenangabe als Organisationsprincipal verwenden. Es SHALL dafür keine zusätzliche generische Berechtigung zum Handeln als Organisation verlangen; maßgeblich sind die fully-qualified Create-Action mit Scope, aktive Organisation, Membership, Richtlinie und Credential-Verfügbarkeit.

Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die dauerhafte DataProvider-Bindung zusammen mit der serverautoritativen Ressourcen-Capability den Mutationsprincipal bestimmen. Ein Policy- oder Membership-Wechsel SHALL persönliche Inhalte nicht auf die Organisation übertragen und Organisationsinhalte nicht auf den Actor übertragen. Die Autorenrichtlinie SHALL die Read-Sicht nicht begrenzen.

Der membership-gefilterte Self-Service-Contract `GET /api/v1/iam/me/context` SHALL die `contentAuthorPolicy` jeder darin enthaltenen Organisation liefern. Die Bestimmung verfügbarer Create-Principals und die ressourcenbezogene Principal-Auflösung für Bestandsmutationen SHALL kein administratives Organisationsleserecht und insbesondere kein `iam.org.read` verlangen. Alle Mainserver-Content-Typen und eigenständigen Schreibaktionen SHALL dieselben host-owned Resolver-Verträge verwenden.

#### Scenario: Organisation erlaubt beim Create nur den organisatorischen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** ist ausschließlich `organization` zulässig
- **AND** die Oberfläche bietet keinen persönlichen Principal an
- **AND** zeigt kein Principal-Dropdown

#### Scenario: Organisation erlaubt beim Create organisatorischen oder persönlichen Principal

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** sind `organization` und `user` zulässig
- **AND** ist im Editor `organization` vorausgewählt und der Benutzer kann im Dropdown zu `user` wechseln
- **AND** die serverseitige Mutation validiert die Auswahl erneut

#### Scenario: Bestehende Organisationsressource verwendet die Organisation

- **GIVEN** eine aktive Organisation ist serverseitig bestätigt
- **AND** ein bestehender Inhalt ist konfliktfrei an den DataProvider dieser Organisation gebunden
- **AND** ein Benutzer löst mit passender Ressourcen-Capability eine Schreibaktion aus einer Liste oder einem Dialog aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = organization`
- **AND** validiert der Server Content-Action, Scope, Membership, Ownership-Bindung und Organisations-Credentials erneut

#### Scenario: Eigenständige Aktion ohne Organisationskontext verwendet den Account

- **GIVEN** keine aktive Organisation ist serverseitig bestätigt
- **AND** ein Benutzer löst eine Schreibaktion außerhalb eines geöffneten Editors aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = user`
- **AND** validiert der Server Content-Action, Scope und persönliche Credentials erneut

#### Scenario: Persönlicher Bestandsinhalt verwendet unabhängig von der Richtlinie den Account

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den persönlichen DataProvider des aktuellen Benutzers gebunden
- **AND** die aktive Organisation hat `content_author_policy = 'org_only'` oder `org_or_personal`
- **AND** der Benutzer löst mit passender Ressourcen-Capability eine Schreibaktion aus
- **WHEN** das Studio den Mutationsprincipal bestimmt
- **THEN** verwendet es ohne zusätzliches Dropdown explizit `actingPrincipalType = user`
- **AND** überträgt die Richtlinie den Inhalt nicht auf die Organisation

#### Scenario: Policy- oder Membership-Wechsel ändert Ownership nicht

- **GIVEN** ein persönlicher oder organisatorischer Inhalt besitzt eine konfliktfreie DataProvider-Bindung
- **WHEN** die Organisation ihre `content_author_policy` ändert oder die Mitgliedschaft des ursprünglichen Actors endet
- **THEN** bleibt der persönliche Inhalt dem persönlichen Principal zugeordnet
- **AND** bleibt der Organisationsinhalt der Organisation zugeordnet
- **AND** entsteht keine implizite Übertragung

#### Scenario: Organisationsredakteur liest die Autorenrichtlinie ohne Adminrecht

- **GIVEN** ein Benutzer ist Mitglied einer aktiven Organisation und besitzt die erforderliche fully-qualified Content-Action
- **AND** der Benutzer besitzt kein `iam.org.read`
- **WHEN** die Shell `GET /api/v1/iam/me/context` lädt
- **THEN** enthält seine Mitgliedschaft die `contentAuthorPolicy` dieser Organisation
- **AND** lädt keine Content-Seite ein administratives Organisationsdetail nach
- **AND** darf der Benutzer nicht allein dadurch Organisationslisten oder administrative Organisationsdetails lesen

#### Scenario: Aktiver Organisationskontext ist unvollständig

- **GIVEN** die Session enthält eine `activeOrganizationId`
- **AND** die referenzierte Organisation fehlt im Self-Service-Kontext, ist inaktiv oder besitzt keine gültige `contentAuthorPolicy`
- **WHEN** die Oberfläche den Mutationsprincipal bestimmt
- **THEN** liefert der zentrale Resolver einen blockierenden Kontextfehler
- **AND** deaktiviert die Oberfläche Create, Update, Statusänderung und Delete für alle Mainserver-Content-Typen
- **AND** fällt sie nicht stillschweigend auf `actingPrincipalType = user` zurück

#### Scenario: Mehrere Mitgliedschaften verwenden exakt die aktive Organisation

- **GIVEN** ein Benutzer ist Mitglied mehrerer aktiver Organisationen
- **AND** `activeOrganizationId` referenziert genau eine dieser Organisationen
- **WHEN** die Oberfläche den Mutationsprincipal bestimmt
- **THEN** wertet sie ausschließlich die Richtlinie der referenzierten Organisation aus
- **AND** verwendet sie nicht die erste Organisation mit `isActive = true`

#### Scenario: Andere Membership ersetzt die aktive Organisation nicht

- **GIVEN** ein Benutzer ist Mitglied mehrerer Organisationen
- **AND** genau eine Organisation ist im Session-Kontext aktiv
- **WHEN** der Benutzer `actingPrincipalType = organization` auswählt
- **THEN** verwendet das System ausschließlich die aktive Organisation
- **AND** durchsucht es keine anderen Memberships oder Default-Kontexte nach Credentials

#### Scenario: Kein aktiver Organisationskontext beim Create

- **GIVEN** für den authentifizierten Benutzer ist keine Organisation aktiv
- **WHEN** das Studio die verfügbaren Erstellungsprincipals bestimmt
- **THEN** ist ausschließlich `user` auswählbar
- **AND** ein `organization`-Scope fällt für Content-Autorisierung auf `own` zurück
