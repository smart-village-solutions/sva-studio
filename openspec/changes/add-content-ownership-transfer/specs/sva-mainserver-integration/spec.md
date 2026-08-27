## MODIFIED Requirements

### Requirement: Mainserver-Projektion trennt Quellkontext von IAM-Ownership

Das System SHALL Mainserver-Quellkontext, DataProvider, Credential-Kontext und externe Organisationswerte getrennt von kanonischer IAM-Ownership führen. Der DataProvider SHALL als aktueller fachlicher Inhaber und sichtbare Autorenidentität geführt werden. Er SHALL bei Create initial gesetzt, durch normale Content-Mutationen erhalten und ausschließlich durch einen bestätigten, mit `content.transferOwnership` autorisierten Transfer geändert werden. `ownerUserId` und `ownerOrganizationId` SHALL ausschließlich aus konfliktfreien automatischen Principal-Bindungen des aktuellen DataProviders abgeleitet werden.

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

#### Scenario: Mutationsprincipal weicht vom aktuellen Inhaber ab

- **GIVEN** ein Inhalt besitzt einen DataProvider
- **AND** ein anderer zulässiger Principal führt eine bestätigte normale Mutation aus
- **WHEN** Studio die Projektion aktualisiert
- **THEN** bleibt die Ownership vom unveränderten Content-DataProvider abgeleitet
- **AND** dokumentiert `credentialSource` getrennt den Mutationsprincipal

#### Scenario: Bestätigter Transfer ändert die Projektion

- **GIVEN** der Mainserver bestätigt einen Transfer von `dp-source` auf `dp-target`
- **AND** `dp-target` ist konfliktfrei an genau einen Ziel-Principal gebunden
- **WHEN** Studio die Projektion aktualisiert
- **THEN** setzt es `sourceDataProviderId = dp-target`
- **AND** leitet genau den Ziel-Account oder die Ziel-Organisation als aktuelle IAM-Ownership ab
- **AND** bewahrt es `dp-source` nur in History und Audit als vorherigen Inhaber

#### Scenario: Ownerloser Mainserver-Datensatz ist im exakten Modus eingeschränkt

- **GIVEN** ein Mainserver-Datensatz besitzt keinen konfliktfrei zugeordneten DataProvider
- **AND** der relevante Scope ist exakt
- **WHEN** ein Benutzer nur `own` oder `organization` besitzt
- **THEN** matcht der Datensatz nicht
- **AND** Zugriff erfordert `all` oder einen Scope im ausdrücklich aktiven Kompatibilitätsmodus

### Requirement: Mainserver-Mutationen verwenden expliziten Organisations- oder Benutzerkontext

Das System SHALL schreibende Mainserver-Mutationen in einem expliziten Principal-Kontext ausführen. Eine Mutation SHALL entweder mit `actingPrincipalType = organization` und validierter aktiver Organisation oder mit `actingPrincipalType = user` und authentifiziertem Account laufen. Die Auswahl SHALL die Credential-Quelle bestimmen. Listenfilter, DataProvider, externe Organisationswerte, andere Memberships oder frühere UI-Auswahlen SHALL die aktive Organisation nicht ersetzen.

Beim Create SHALL `contentAuthorPolicy` die zulässige Wahl begrenzen. Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die konfliktfreie DataProvider-Bindung zusammen mit der Ressourcen-Capability den Principal festlegen. Ein Same-Credential-Pre-Read SHALL die aktuelle Verfügbarkeit und den Content-DataProvider liefern. Update, Veröffentlichung, Archivierung und Wiederherstellung SHALL den DataProvider gemäß bestätigter Typ-/Aktionsmatrix erhalten. Ausschließlich der getrennte Ownership-Transfer SHALL nach erfolgreicher Source-Autorisierung und serverseitiger Zielauflösung eine Ziel-DataProvider-ID senden. Hard Delete SHALL den Provider aus dem Preimage auditieren und keinen Post-Read verlangen.

#### Scenario: Benutzer erstellt Datensatz im Namen der aktiven Organisation

- **GIVEN** die Session enthält eine validierte aktive Organisation
- **AND** deren Credentials sind vollständig
- **WHEN** der Benutzer mit `actingPrincipalType = organization` erstellt
- **THEN** verwendet Studio ausschließlich deren Credentials
- **AND** bestätigt der zurückgelieferte DataProvider ausschließlich die vorab per Identity-Endpunkt verifizierte Bindung dieser Credential-Version
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
- **AND** bestätigt der zurückgelieferte DataProvider ausschließlich die vorab per Identity-Endpunkt verifizierte persönliche Bindung
- **AND** setzt Studio keine Organisationsownership

#### Scenario: Persönlicher Bestandsinhalt verwendet den persönlichen Principal

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den persönlichen DataProvider des aktuellen Benutzers gebunden
- **AND** die aktive Organisation erzwingt bei Creates `content_author_policy = 'org_only'`
- **WHEN** der Benutzer den Inhalt mit passender Ressourcen-Capability normal mutiert
- **THEN** verwendet Studio `actingPrincipalType = user`
- **AND** ändert oder überträgt es die Ownership nicht

#### Scenario: Organisationsinhalt verwendet den Organisationsprincipal

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den DataProvider der aktiven Organisation gebunden
- **WHEN** ein berechtigtes Mitglied den Inhalt normal mutiert
- **THEN** verwendet Studio `actingPrincipalType = organization`
- **AND** bleibt der tatsächliche Benutzer als Actor im Audit erhalten

#### Scenario: Bestehende Mutation verwendet Same-Credential-Pre-Read

- **GIVEN** ein Benutzer möchte einen bestehenden Inhalt aktualisieren oder übertragen
- **WHEN** Studio die Mutation autorisiert
- **THEN** liest es den Inhalt unmittelbar mit dem gebundenen Quell-Write-Credential
- **AND** verwendet DataProvider und Verfügbarkeit dieses Reads für die Source-Scope-Entscheidung
- **AND** führt bei fehlendem Zugriff keinen Write aus

#### Scenario: Normales Update erhält bestehenden DataProvider

- **GIVEN** Pre-Read liefert DataProvider `dp-original`
- **AND** die Typ-/Aktionsmatrix bestätigt Immutabilität für dieses normale Update
- **WHEN** Studio den Write mit einem zulässigen Principal ausführt
- **THEN** erwartet es weiterhin `dp-original`
- **AND** behandelt eine Abweichung als `reconciliation_required`

#### Scenario: Transfer verwendet eine serverseitig aufgelöste Zielbindung

- **GIVEN** Pre-Read liefert DataProvider `dp-source`
- **AND** `content.transferOwnership` autorisiert den aktuellen Inhalt
- **AND** der aktive Ziel-Principal derselben Instanz ist eindeutig und aktuell an `dp-target` gebunden
- **WHEN** Studio den Transfer vorbereitet
- **THEN** verwendet es den Quell-Principal und dessen Credentials zur Ausführung
- **AND** übermittelt `dp-target` ausschließlich aus der serverseitigen Binding-Auflösung
- **AND** akzeptiert keine DataProvider-ID aus dem Browser

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

## ADDED Requirements

### Requirement: Mainserver-Inhabertransfer verwendet eine bestätigte Typmatrix

Das System SHALL einen Mainserver-Inhabertransfer nur für Content-Typen anbieten und ausführen, deren Mutation die explizite DataProvider-Auswahl, abhängige Datensätze, ExternalReference-Konsistenz, Transaktionsgrenze und Fehlersemantik vertraglich bestätigt. Die serverseitige Capability-Matrix SHALL die einzige Quelle für API und UI sein.

#### Scenario: V1-Typ unterstützt Transfer

- **WHEN** NewsItem, EventRecord, PointOfInterest, Tour oder ein Root-GenericItem übertragen werden soll
- **AND** der Runtime-Preflight bestätigt den erwarteten Mainserver-Vertrag
- **THEN** kann die serverseitige Capability-Matrix den Transfer freigeben
- **AND** verwendet die Mutation den typisierten `dataProviderId`-Vertrag

#### Scenario: Abhängige Datensätze werden atomar mitgeführt

- **GIVEN** ein unterstützter Root-Datensatz besitzt TourStops, POI-Voucher, GenericItem-Kinder oder ExternalReferences
- **WHEN** der Mainserver den DataProvider-Transfer bestätigt
- **THEN** besitzen alle vertraglich abhängigen Datensätze und ExternalReferences denselben Ziel-DataProvider
- **AND** führt ein Fehler beim Mitführen zu einem vollständigen Upstream-Rollback

#### Scenario: Survey ist in V1 nicht unterstützt

- **WHEN** ein Benutzer den Inhaber eines Survey, Legacy SurveyPoll oder eines anderen nicht bestätigten Typs übertragen will
- **THEN** liefert die Capability-Matrix `unsupported`
- **AND** zeigt die UI keine aktive Transferaktion
- **AND** sendet Studio keine optimistische oder generische GraphQL-Mutation

#### Scenario: Mainserver-Schema besitzt den Transfervertrag nicht

- **GIVEN** das verifizierte Ziel-Schema enthält für einen erwarteten V1-Typ kein `dataProviderId`
- **WHEN** Studio Capability oder Transferadapter initialisiert
- **THEN** bleibt der Transfer für diesen Typ deaktiviert
- **AND** ersetzt Studio den fehlenden Upstream-Vertrag nicht durch lokale Ownership-Umschreibung

### Requirement: Mainserver-Transfer klärt unklare Provider-Ergebnisse fail-closed

Das System SHALL jeden Mainserver-Inhabertransfer unter einer stabilen Operationsreferenz im bestehenden Mutationsjournal führen. Bei verlorenem oder unklarem Response SHALL es Ziel- und Quell-Evidenz lesen, bevor es Erfolg, Wiederholung oder `reconciliation_required` festlegt.

#### Scenario: Target-Re-Read bestätigt den Transfer

- **GIVEN** der Transfer-Response ging nach möglichem Provider-Commit verloren
- **WHEN** ein Read mit den Ziel-Credentials denselben Inhalt unter `dp-target` bestätigt
- **THEN** finalisiert Studio den Transfer als erfolgreich
- **AND** wiederholt es keine Provider-Mutation

#### Scenario: Source-Re-Read bestätigt den unveränderten Zustand

- **GIVEN** ein Target-Re-Read bestätigt den Ziel-DataProvider nicht
- **WHEN** ein Source-Re-Read den Inhalt weiterhin eindeutig unter `dp-source` liefert
- **THEN** darf Studio dieselbe reservierte Operationsreferenz kontrolliert wiederaufnehmen
- **AND** erzeugt es keinen zweiten fachlichen Transferauftrag

#### Scenario: Source und Target liefern keine eindeutige Evidenz

- **GIVEN** Response, Target-Re-Read und Source-Re-Read erlauben keine eindeutige Zustandsentscheidung
- **WHEN** Studio den Vorgang auswertet
- **THEN** setzt es `reconciliation_required`
- **AND** sperrt es weitere automatische Transfers für denselben Inhalt
- **AND** behauptet weder Erfolg noch Rollback

#### Scenario: Lokale Folgearbeit scheitert nach bestätigt erfolgreichem Transfer

- **GIVEN** der Mainserver hat `dp-target` bestätigt
- **WHEN** Projektion, History oder Audit-Finalisierung lokal fehlschlägt
- **THEN** bleibt der Provider-Transfer fachlich erfolgreich
- **AND** markiert Studio ausschließlich die lokale Folgearbeit als reconciliation-pflichtig
