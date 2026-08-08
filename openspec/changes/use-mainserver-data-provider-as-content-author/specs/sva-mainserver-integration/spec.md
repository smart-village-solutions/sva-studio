## ADDED Requirements

### Requirement: Expliziter Mutationsprincipal bestimmt Mainserver-Credentials

Das System MUST für jede Studio-initiierte Mainserver-Schreibaktion einen expliziten `actingPrincipalType` mit `organization` oder `user` unterstützen. Es MUST die Auswahl serverseitig gegen authentifizierten Account, aktive Organisation, Membership, `content_author_policy`, fully-qualified Content-Permission, Scope und Credential-Verfügbarkeit validieren und ausschließlich die zugehörigen Credentials verwenden. Eine zusätzliche generische Permission zum Handeln als Organisation MUST es dafür nicht verlangen.

Der daraus erzeugte `MutationPrincipalContext` MUST für Pre-Read, Read-Merge-Write, Provider-Write, Status- oder Visibility-Zweitschritt, Post-Read, Projection-Refresh, Audit und Reconciliation stabil bleiben.

#### Scenario: Expliziter Organisationsprincipal besitzt keine Credentials

- **GIVEN** `organization` ist für die aktive Organisation zulässig
- **AND** für diese Organisation fehlen Mainserver-Credentials
- **WHEN** Studio eine Mutation ausführt
- **THEN** schlägt sie vor dem GraphQL-Aufruf mit einem spezifischen Credential-Fehler fehl
- **AND** das System fällt nicht auf persönliche Credentials zurück

#### Scenario: Persönlicher Principal ist durch Richtlinie verboten

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** ein Client `actingPrincipalType = user` übermittelt
- **THEN** lehnt der Server die Mutation vor dem GraphQL-Aufruf ab
- **AND** verwendet weder persönliche noch organisatorische Credentials ersatzweise

#### Scenario: Principal-Auswahl erweitert Content-Action nicht

- **GIVEN** der Benutzer besitzt die angeforderte fully-qualified Content-Action nicht
- **WHEN** er einen technisch verfügbaren persönlichen oder organisatorischen Principal auswählt
- **THEN** lehnt der Server die Mutation vor dem GraphQL-Aufruf ab
- **AND** erzeugt die Credential-Auswahl keine zusätzliche Permission

#### Scenario: Principal bleibt über mehrstufige Mutation stabil

- **GIVEN** eine fachliche Aktion besteht aus Pre-Read, Provider-Write und Visibility- oder Status-Zweitschritt
- **WHEN** Studio die Aktion ausführt
- **THEN** verwenden alle Schritte denselben `MutationPrincipalContext`
- **AND** kein Schritt löst Credentials erneut über einen impliziten Fallback auf

#### Scenario: Credential-Caches trennen die Principals

- **GIVEN** derselbe Benutzer kann persönlich und organisatorisch handeln
- **WHEN** aufeinanderfolgende Mutationen unterschiedliche Principal-Typen verwenden
- **THEN** verwendet jede Mutation die explizit gewählte Quelle
- **AND** Credential- oder Token-Caches liefern niemals einen Eintrag des anderen Principal

### Requirement: DataProvider-Bindungen entstehen ausschließlich automatisch

Das System MUST Principal-zu-DataProvider-Bindungen instanzgebunden und credential-versioniert führen. Eine neue Bindung MUST ausschließlich aus einem erfolgreichen Create mit exakt gebundenen Credentials und der anschließend aus Create-Response oder Same-Credential-Re-Read gelesenen DataProvider-ID oder zukünftig aus einer stabilen authentifizierten Identity-ID entstehen.

Namen, Listen, Details, Updates, Statusänderungen, Deletes, Client-Payloads und administrative Eingaben MUST als Mapping-Beweis ausgeschlossen sein. Abweichende Provider-IDs oder konkurrierende Principal-Claims MUST einen Konflikt erzeugen und dürfen keine bestehende Bindung überschreiben.

#### Scenario: Persönlicher Create erzeugt automatische Bindung

- **GIVEN** persönliches Handeln ist autorisiert und persönliche Credentials sind verfügbar
- **WHEN** Studio mit diesen Credentials erfolgreich einen Inhalt erstellt
- **AND** Response oder Same-Credential-Re-Read liefert DataProvider `dp-user-1`
- **THEN** bindet Studio die aktuelle persönliche Credential-Version automatisch an `dp-user-1`
- **AND** speichert es den Credential-Fingerprint und die Nachweisquelle `create_observation`

#### Scenario: Organisations-Create erzeugt automatische Bindung

- **GIVEN** die aktive Organisation ist als Principal autorisiert
- **WHEN** Studio mit deren Credentials erfolgreich einen Inhalt erstellt
- **AND** der Mainserver bestätigt DataProvider `dp-org-1`
- **THEN** bindet Studio die aktuelle organisatorische Credential-Version automatisch an `dp-org-1`
- **AND** verwendet keine andere Membership als Principal

#### Scenario: Wiederholter Create bestätigt bestehende Bindung

- **GIVEN** die aktuelle Credential-Version ist bereits an DataProvider `dp-1` gebunden
- **WHEN** ein weiterer erfolgreicher Create denselben DataProvider bestätigt
- **THEN** aktualisiert Studio den Nachweis idempotent
- **AND** erzeugt keine zweite konkurrierende Bindung

#### Scenario: Create beobachtet abweichenden Provider

- **GIVEN** für den Principal existiert eine aktuelle Bindung an `dp-1`
- **WHEN** ein erfolgreicher Create DataProvider `dp-2` zurückliefert
- **THEN** überschreibt Studio `dp-1` nicht
- **AND** markiert die Beobachtung als `conflict`
- **AND** behandelt den Provider-Erfolg als `reconciliation_required`

#### Scenario: Zwei Principals beobachten denselben Provider

- **GIVEN** DataProvider `dp-1` ist bereits konfliktfrei einem Principal zugeordnet
- **WHEN** ein anderer Principal ihn durch einen Create oder Identity-Nachweis beansprucht
- **THEN** überschreibt Studio die Zuordnung nicht
- **AND** markiert die konkurrierenden Claims als Konflikt
- **AND** aktiviert für die betroffenen Scopes keine exakte Auswertung

#### Scenario: Update begründet kein Mapping

- **GIVEN** ein Principal aktualisiert erfolgreich einen Content eines bestehenden DataProviders
- **WHEN** die Mutation oder der Post-Read diesen DataProvider zurückliefert
- **THEN** verwendet Studio ihn ausschließlich als Content-Inhaber
- **AND** leitet daraus keine Bindung des handelnden Principal ab

#### Scenario: Credential-Rotation benötigt neue Evidenz

- **GIVEN** ein Principal besitzt eine Bindung für eine frühere Credential-Version
- **WHEN** Key oder Secret rotiert wird
- **THEN** bleibt die historische Bindung für bestehende Inhalte erhalten
- **AND** gilt die neue Credential-Version bis zu Create- oder Identity-Bestätigung als noch nicht exakt gebunden

### Requirement: DataProvider-Identity-Response wird strikt und PII-minimiert verarbeitet

Das System MUST `/data_provider.json` mit demselben Bearer Token wie die GraphQL-Integration aufrufen und den tatsächlichen HTTP-Body als JSON-Objekt mit `data_provider` validieren. Es MUST ausschließlich eine normalisierte DataProvider-ID und optional den Namen übernehmen. Kontakt-, Adress-, Beschreibungs-, Notice-, Logo-, Header- und Rohresponse-Daten MUST aus Mapping, Logs, Metriken und Audit-Payloads ausgeschlossen bleiben.

Eine erfolgreiche Antwort ohne ID MUST als erwarteter Vertragszustand behandelt werden. Sie MUST weder eine Bindung noch eine Berechtigungsänderung erzeugen.

#### Scenario: Identity-Response enthält eine ID

- **GIVEN** `/data_provider.json` antwortet erfolgreich mit gültigem `data_provider`
- **AND** `data_provider.id` enthält einen nicht leeren String oder eine Ganzzahl
- **WHEN** Studio die Response verarbeitet
- **THEN** normalisiert es die ID auf einen String
- **AND** bestätigt es eine gleiche aktuelle Bindung
- **AND** erzeugt es bei einer abweichenden ID einen Konflikt statt einer stillen Überschreibung

#### Scenario: Gültige Identity-Response enthält noch keine ID

- **GIVEN** `/data_provider.json` antwortet erfolgreich mit gültigem `data_provider`
- **AND** `data_provider.id` fehlt, ist `null` oder leer
- **WHEN** Studio die Response verarbeitet
- **THEN** erzeugt oder verändert es kein Mapping
- **AND** bestimmt die Mapping-Readiness weiterhin aus automatischen Create-Beobachtungen
- **AND** verwechselt es die fehlende ID nicht mit einem technischen Fehler

#### Scenario: Identity-Response ist technisch oder strukturell ungültig

- **GIVEN** der HTTP-Status ist nicht erfolgreich, der Body ist ungültig oder `data_provider` fehlt
- **WHEN** Studio die Identity-Response verarbeitet
- **THEN** erzeugt oder verändert es kein Mapping
- **AND** erweitert es keine Berechtigung aufgrund dieses Fehlers
- **AND** darf eine durch OAuth und Same-Credential-Read separat bestätigte Content-Aktion weiter nach deren eigenem Vertrag bewerten

#### Scenario: Identity-Response enthält personenbezogene Kontaktdaten

- **GIVEN** `data_provider` enthält Kontakt-, Adress- oder weitere beschreibende Daten
- **WHEN** Studio Mapping, Telemetrie oder Audit erzeugt
- **THEN** übernimmt es höchstens ID, optionalen Anzeigenamen und technische Ergebnis-Metadaten
- **AND** speichert es weder Rohantwort noch personenbezogene Kontaktwerte

### Requirement: Typ- und Aktionsmatrix begrenzt Mainserver-Schreibverträge

Das System MUST vor Aktivierung einer Mainserver-Content-Aktion einen bestätigten typisierten Vertrag für Pre-Read, Mutation, DataProvider-Response, Lifecycle, Idempotenz und Reconciliation besitzen. Nicht bestätigte Typ-/Aktionskombinationen MUST capability-gated bleiben.

#### Scenario: Typ liefert DataProvider nicht sicher

- **GIVEN** ein Detail- oder Mutation-Adapter selektiert `dataProvider.id` nicht typisiert
- **WHEN** Studio die Aktion für exakte Autorisierung, Create-Bindung oder Integritätsprüfung benötigt
- **THEN** bleibt diese Typ-/Aktionskombination deaktiviert
- **AND** synthetische Projektionswerte ersetzen den fehlenden Vertrag nicht

#### Scenario: Hard Delete besitzt keinen Post-Read

- **GIVEN** ein Typ unterstützt Hard Delete
- **WHEN** der Mainserver den Delete erfolgreich bestätigt
- **THEN** verwendet Studio DataProvider und Content-Metadaten aus dem Preimage
- **AND** verlangt keinen erfolgreichen Post-Delete-Read
- **AND** finalisiert einen korrelierten Tombstone

#### Scenario: Survey-Immutabilität ist nicht bestätigt

- **GIVEN** der reale Survey-Vertrag bestätigt nicht, dass ein Update mit fremdem Principal den DataProvider erhält
- **WHEN** Studio Survey-Aktionen aktiviert
- **THEN** aktiviert es nur die belegten Principal-/Aktionskombinationen
- **AND** übernimmt keine pauschale Immutabilitätsgarantie anderer Typen

### Requirement: Mainserver-Mutationsjournal korreliert Provider-Erfolg und lokale Folgearbeit

Das System MUST für Studio-initiierte Mainserver-Mutationen eine persistente Operationsreferenz mit Actor, Principal, Credential-Fingerprint, erwartetem und beobachtetem DataProvider, Teiloperationen, Provider-Outcome, Retry- und Reconciliation-Zustand führen.

#### Scenario: Provider-Erfolg und lokale Folgearbeit schlagen auseinander

- **GIVEN** der Mainserver hat eine Mutation erfolgreich bestätigt
- **WHEN** Projection, History, Mapping-Prüfung oder Tombstone-Finalisierung fehlschlägt
- **THEN** bleibt der Provider-Erfolg als Erfolg ausgewiesen
- **AND** markiert Studio die lokale Folgearbeit als `reconciliation_required`
- **AND** kann ein Retry dieselbe Operationsreferenz idempotent fortsetzen

#### Scenario: Hard Delete persistiert das Preimage

- **GIVEN** Studio führt einen autorisierten Hard Delete aus
- **WHEN** der Same-Credential-Pre-Read erfolgreich ist
- **THEN** persistiert Studio vor dem Delete mindestens Content-ID, Content-Typ, DataProvider, Actor, Principal und Credential-Fingerprint
- **AND** finalisiert nach Provider-Erfolg einen Tombstone unter derselben Operationsreferenz

## MODIFIED Requirements

### Requirement: News Mutations Preserve Policy-Driven Mainserver Delegation

The system SHALL execute News create, update, archive, and delete mutations with the explicit Mainserver credentials selected by `actingPrincipalType`. For `org_only`, mutation paths use only the active organization's credentials. For `org_or_personal`, the client selects `organization` or `user` explicitly and the server MUST NOT silently fall back to the other source.

#### Scenario: News mutation uses organization credentials for `org_only`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_only`
- **WHEN** the user submits a valid News mutation with `actingPrincipalType = organization`
- **THEN** the server obtains an access token using the active organization's Mainserver credentials
- **AND** all causal reads and writes use that same credential context
- **AND** the resulting News item is mapped back to the Plugin News model

#### Scenario: News mutation explicitly uses user credentials for `org_or_personal`

- **GIVEN** a user has local Studio permission and `contentAuthorPolicy` is `org_or_personal`
- **WHEN** the user submits `actingPrincipalType = user`
- **THEN** the server uses only the current user's Keycloak-backed credentials
- **AND** it does not first try or fall back to organization credentials

#### Scenario: Selected News credential is missing

- **GIVEN** the selected explicit Principal has no complete credential set
- **WHEN** the user submits a News mutation
- **THEN** no upstream request starts
- **AND** Studio returns the deterministic error for that selected credential source

#### Scenario: Mainserver denies mutation

- **GIVEN** local Studio authorization succeeds but the Mainserver denies the delegated mutation
- **WHEN** the mutation response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with another credential source

### Requirement: Event And POI Mutations Preserve Policy-Driven Mainserver Delegation

The system SHALL execute Event and POI create, update, archive, and delete mutations with the explicit Mainserver credentials selected by `actingPrincipalType`. For `org_only`, mutation paths use only the active organization's credentials. For `org_or_personal`, the client selects `organization` or `user` explicitly and the server MUST NOT silently fall back to the other source.

#### Scenario: Event mutation uses organization credentials for `org_only`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_only`
- **WHEN** the user submits a valid Event mutation with `actingPrincipalType = organization`
- **THEN** the server uses only the active organization's credentials
- **AND** all causal reads and writes use that credential context

#### Scenario: POI mutation explicitly uses user credentials

- **GIVEN** `contentAuthorPolicy` is `org_or_personal`
- **WHEN** the user submits a POI mutation with `actingPrincipalType = user`
- **THEN** the server uses only the current user's credentials
- **AND** it does not retry with organization credentials

#### Scenario: Selected Event or POI credential is missing

- **GIVEN** the explicitly selected Principal has no complete credentials
- **WHEN** the user submits an Event or POI mutation
- **THEN** no upstream request starts
- **AND** Studio returns the deterministic error for that source

#### Scenario: Mainserver denies mutation

- **GIVEN** local Studio authorization succeeds but the Mainserver denies the delegated Event or POI mutation
- **WHEN** the response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with another credential source

### Requirement: Mainserver-Credential-Auflösung respektiert den aktiven Organisationskontext

The system SHALL resolve SVA Mainserver credentials server-side. For Studio-initiated content mutations, `actingPrincipalType` SHALL select exactly `organization` or `user` and SHALL disable implicit cross-source fallback. Pure reads and background reconciliation without a bound mutation context SHALL use user credentials for `org_or_personal` and organization credentials only for `org_only`. The chosen source SHALL be returned and included in cache and projection isolation.

#### Scenario: Explicit organization mutation uses only organization credentials

- **GIVEN** a content mutation uses `actingPrincipalType = organization`
- **WHEN** credential resolution starts
- **THEN** the resolver uses only credentials of the active organization
- **AND** missing or incomplete credentials return `organization_mainserver_credentials_missing`
- **AND** no user fallback occurs

#### Scenario: Explicit user mutation uses only user credentials

- **GIVEN** a content mutation uses `actingPrincipalType = user`
- **WHEN** credential resolution starts
- **THEN** the resolver uses only current or compatible legacy user credentials
- **AND** no organization lookup or fallback occurs

#### Scenario: Pure read defaults to the personal principal

- **GIVEN** a pure read is not causally bound to a mutation
- **WHEN** the active organization's `contentAuthorPolicy` is `org_or_personal`
- **THEN** the resolver uses current-user credentials
- **AND** it does not prefer or fall back to organization credentials
- **AND** it returns the actual credential source
- **AND** caches and projections remain isolated by that source or credential signature

#### Scenario: No active organization blocks explicit organization mutation

- **GIVEN** a mutation uses `actingPrincipalType = organization`
- **AND** the session has no validated active organization
- **WHEN** credential resolution starts
- **THEN** no upstream request starts
- **AND** the resolver returns `organization_mainserver_credentials_missing`

#### Scenario: Missing explicit user credentials returns deterministic error

- **GIVEN** a mutation uses `actingPrincipalType = user`
- **AND** neither current nor compatible legacy user credentials are complete
- **WHEN** credential resolution starts
- **THEN** no upstream request starts
- **AND** the resolver returns `missing_credentials`

#### Scenario: Mutation context prevents resolver drift

- **GIVEN** a mutation already resolved its explicit credentials
- **WHEN** it performs Pre-Read, Write, Post-Read or Reconciliation
- **THEN** those steps reuse the bound `MutationPrincipalContext`
- **AND** they do not invoke the general organization-first resolver again

### Requirement: V2-Mutationen binden den geladenen Sessionkontext

Das System MUST bei V2-Updates und -Deletes einen nicht autorisierenden Kontext-Bindungswert aus einem aktuellen Detail-Read verlangen und ihn vor dem Provider-Write gegen den authentifizierten Session- und Organisationskontext prüfen. Ein Client ohne vorhandenen Bindungswert MUST das Detail vor der Mutation erneut laden und MUST fail-closed abbrechen, wenn der Read keinen Bindungswert liefert. Requests ohne Vertragsversion dürfen nur im konfigurierten Legacy-Übergang ohne diesen Wert verarbeitet werden.

#### Scenario: V2-Update ohne Kontextbindung wird abgelehnt

- **GIVEN** ein Client sendet Vertragsversion 2
- **WHEN** er ein bestehendes Mainserver-Objekt ohne Kontext-Bindungswert aktualisiert
- **THEN** beginnt kein Provider-Write
- **AND** Studio antwortet mit einem deterministischen Context-Binding-Fehler

### Requirement: Projektionsscopes isolieren explizite Principals

Das System SHALL gezielte Mutation-Refreshes nach `user` und `organization` im Projektionsscope isolieren. Ein automatischer Full-Refresh SHALL nur seinen eigenen Scope ersetzen oder löschen und SHALL keine Zeilen eines expliziten anderen Principal-Scopes entfernen. Listenreads SHALL die für den aktuellen Account und die aktive Organisation zulässigen Principal-Scopes berücksichtigen.

#### Scenario: Persönlicher Full-Refresh erhält organisatorische Mutationsprojektion

- **GIVEN** ein `org_or_personal`-Kontext enthält eine durch eine Organisationsmutation aktualisierte Projektionszeile
- **WHEN** ein impliziter Full-Refresh mit persönlichen Credentials läuft
- **THEN** bleibt die organisatorische Projektionszeile erhalten

### Requirement: Mainserver-Projektion trennt Quellkontext von IAM-Ownership

Das System SHALL Mainserver-Quellkontext, DataProvider, Credential-Kontext und externe Organisationswerte getrennt von kanonischer IAM-Ownership führen. Der DataProvider SHALL als unveränderliche ursprüngliche Inhaber- und Autorenidentität geführt werden. `ownerUserId` und `ownerOrganizationId` SHALL ausschließlich aus konfliktfreien automatischen Principal-Bindungen abgeleitet werden.

Credential-Kontext, aktive Abfrageorganisation, freie Autorenwerte, externe Organisationsfelder oder der aktuelle Actor SHALL keine konkurrierende Ownership begründen. Im Modus `credential_visible_compatibility` SHALL die Projektion keine erfundene Owner-Zuordnung persistieren.

#### Scenario: Externe Organisation wird als Quellmetadatum projiziert

- **GIVEN** ein Mainserver-Datensatz enthält eine externe Organisation oder einen DataProvider
- **WHEN** Studio ihn in die Inhaltsliste projiziert
- **THEN** speichert die Projektion diese Werte als Quellmetadaten
- **AND** setzt keinen IAM-Owner allein aufgrund externer Werte

#### Scenario: DataProvider ist automatisch einem Account zugeordnet

- **GIVEN** ein Mainserver-Datensatz enthält DataProvider `dp-user-1`
- **AND** eine konfliktfreie automatische Bindung ordnet ihn Account `account-1` zu
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt es `sourceDataProviderId = dp-user-1`
- **AND** leitet `ownerUserId = account-1` als rekonstruierbare IAM-Projektion ab
- **AND** setzt keine Organisationsownership aus dem aktiven Kontext

#### Scenario: DataProvider ist automatisch einer Organisation zugeordnet

- **GIVEN** ein Mainserver-Datensatz enthält DataProvider `dp-org-1`
- **AND** eine konfliktfreie automatische Bindung ordnet ihn Organisation `org-1` zu
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt es `sourceDataProviderId = dp-org-1`
- **AND** leitet `ownerOrganizationId = org-1` als rekonstruierbare IAM-Projektion ab

#### Scenario: Kompatibilitätsmodus erfindet keinen Owner

- **GIVEN** die für den Scope erforderliche automatische Bindung fehlt oder ist konfliktbehaftet
- **WHEN** Studio den Datensatz projiziert
- **THEN** persistiert es DataProvider und Credential-Kontext als Quellmetadaten
- **AND** setzt keinen Owner aus Actor, aktiver Organisation oder Credential-Quelle
- **AND** kennzeichnet die Scope-Auswertung als `credential_visible_compatibility`

#### Scenario: Mutationsprincipal weicht vom ursprünglichen Inhaber ab

- **GIVEN** ein Inhalt besitzt einen DataProvider
- **AND** ein anderer zulässiger Principal führt eine bestätigte Mutation aus
- **WHEN** Studio die Projektion aktualisiert
- **THEN** bleibt die Ownership vom Content-DataProvider abgeleitet
- **AND** dokumentiert `credentialSource` getrennt den Mutationsprincipal

#### Scenario: Ownerloser Mainserver-Datensatz ist im exakten Modus eingeschränkt

- **GIVEN** ein Mainserver-Datensatz besitzt keinen konfliktfrei zugeordneten DataProvider
- **AND** der relevante Scope ist exakt
- **WHEN** ein Benutzer nur `own` oder `organization` besitzt
- **THEN** matcht der Datensatz nicht
- **AND** Zugriff erfordert `all` oder einen Scope im ausdrücklich aktiven Kompatibilitätsmodus

### Requirement: Mainserver-Mutationen verwenden expliziten Organisations- oder Benutzerkontext

Das System SHALL schreibende Mainserver-Mutationen in einem expliziten Principal-Kontext ausführen. Eine Mutation SHALL entweder mit `actingPrincipalType = organization` und validierter aktiver Organisation oder mit `actingPrincipalType = user` und authentifiziertem Account laufen. Die Auswahl SHALL die Credential-Quelle bestimmen. Listenfilter, DataProvider, externe Organisationswerte, andere Memberships oder frühere UI-Auswahlen SHALL die aktive Organisation nicht ersetzen.

Bei bestehenden Inhalten SHALL ein Same-Credential-Pre-Read die aktuelle Verfügbarkeit und den Content-DataProvider liefern. Update, Veröffentlichung, Archivierung und Wiederherstellung SHALL den DataProvider gemäß bestätigter Typ-/Aktionsmatrix erhalten. Hard Delete SHALL den Provider aus dem Preimage auditieren und keinen Post-Read verlangen.

#### Scenario: Benutzer erstellt Datensatz im Namen der aktiven Organisation

- **GIVEN** die Session enthält eine validierte aktive Organisation
- **AND** deren Credentials sind vollständig
- **WHEN** der Benutzer mit `actingPrincipalType = organization` erstellt
- **THEN** verwendet Studio ausschließlich deren Credentials
- **AND** erzeugt oder bestätigt der zurückgelieferte DataProvider automatisch die Bindung dieser Credential-Version
- **AND** berücksichtigt Studio keine andere Membership

#### Scenario: Aktive Organisation fehlt bei Organisationsmutation

- **GIVEN** der Request verwendet `actingPrincipalType = organization`
- **AND** die Session enthält keine validierte aktive Organisation
- **WHEN** die Mutation ausgeführt werden soll
- **THEN** weist Studio sie vor dem Mainserver-Aufruf ab
- **AND** errät keine Organisation aus DataProvider, Memberships oder früherer Auswahl

#### Scenario: Persönlicher Create bleibt persönlich

- **GIVEN** persönliches Handeln ist zulässig
- **WHEN** ein Benutzer mit `actingPrincipalType = user` erstellt
- **THEN** verwendet Studio ausschließlich seine persönlichen Credentials
- **AND** erzeugt oder bestätigt der zurückgelieferte DataProvider deren automatische Bindung
- **AND** setzt Studio keine Organisationsownership

#### Scenario: Bestehende Mutation verwendet Same-Credential-Pre-Read

- **GIVEN** ein Benutzer möchte einen bestehenden Inhalt aktualisieren
- **WHEN** Studio die Mutation autorisiert
- **THEN** liest es den Inhalt unmittelbar mit dem gebundenen Write-Credential
- **AND** verwendet DataProvider und Verfügbarkeit dieses Reads für die Scope-Entscheidung
- **AND** führt bei fehlendem Zugriff keinen Write aus

#### Scenario: Update erhält bestehenden DataProvider

- **GIVEN** Pre-Read liefert DataProvider `dp-original`
- **AND** die Typ-/Aktionsmatrix bestätigt Immutabilität für dieses Update
- **WHEN** Studio den Write mit einem zulässigen Principal ausführt
- **THEN** erwartet es weiterhin `dp-original`
- **AND** behandelt eine Abweichung als `reconciliation_required`

#### Scenario: Hard Delete verwendet Preimage statt Post-Read

- **GIVEN** Pre-Read liefert DataProvider `dp-original`
- **AND** der Benutzer besitzt die separate Delete-Permission
- **WHEN** der Mainserver den Hard Delete bestätigt
- **THEN** finalisiert Studio den Tombstone mit `dp-original`
- **AND** interpretiert einen fehlenden Post-Delete-Datensatz nicht als Integritätsverletzung

#### Scenario: Persönliche Mutation dokumentiert Credential-Herkunft

- **GIVEN** eine Mutation läuft mit `actingPrincipalType = user`
- **WHEN** Studio Projection, Journal und Audit nachzieht
- **THEN** speichert es `credentialSource = user` oder eine äquivalente Herkunft
- **AND** setzt keine synthetische Organisationsownership
