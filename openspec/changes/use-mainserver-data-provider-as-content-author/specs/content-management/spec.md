## ADDED Requirements

### Requirement: Mainserver-Schreibaktionen behandeln Inhaber und Mutationsprincipal getrennt

Das System SHALL bei der Erstellung eines Mainserver-basierten Contents den serverseitig validierten `actingPrincipalType` als Quelle der OAuth-Credentials verwenden und den daraus vom Mainserver gesetzten `dataProvider` als unveränderlichen ursprünglichen Inhaber übernehmen. Vor dem Create SHALL der Identity-Endpunkt die aktuelle Credential-Version binden; der bestätigte Create-DataProvider SHALL diese Bindung anschließend konsistent bestätigen.

Jede Studio-initiierte Schreibaktion zum Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen oder Löschen SHALL einen expliziten Principal-Typ verwenden. Beim Create SHALL `contentAuthorPolicy` die zulässige Eigentümerwahl begrenzen. Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die konfliktfreie DataProvider-Bindung zusammen mit der Ressourcen-Capability den Principal und die Credential-Quelle bestimmen; die Oberfläche SHALL keinen freien Principal-Wechsel anbieten. Keine Aktion SHALL ein neues Principal-Mapping aus einem Content-Read begründen oder den bestehenden DataProvider ändern beziehungsweise als geändert darstellen.

#### Scenario: Organisation erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** die aktive Organisation erlaubt organisatorisches Handeln und besitzt Mainserver-Credentials
- **AND** der Identity-Endpunkt hat die aktuelle Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = organization` erstellt
- **THEN** führt der Server den Create ausschließlich mit deren Credentials aus
- **AND** liest er den bestätigten DataProvider aus Response oder Same-Credential-Re-Read
- **AND** bestätigt er damit ausschließlich die bereits verifizierte credential-versionierte Organisationsbindung

#### Scenario: Person erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** persönliches Handeln ist zulässig
- **AND** der Identity-Endpunkt hat die aktuelle persönliche Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = user` erstellt
- **THEN** führt der Server den Create ausschließlich mit den persönlichen Credentials aus
- **AND** bestätigt der Content-DataProvider ausschließlich die bereits verifizierte Bindung

#### Scenario: Create kollidiert mit bestehender Bindung

- **GIVEN** die aktuelle Credential-Version ist bereits einem anderen DataProvider zugeordnet
- **WHEN** ein erfolgreicher Create einen abweichenden DataProvider bestätigt
- **THEN** überschreibt Studio die Bindung nicht
- **AND** markiert Mapping und lokale Folgearbeit als `reconciliation_required`
- **AND** stellt den bestätigten Provider-Erfolg nicht als zurückgerollt dar

#### Scenario: Bearbeitung verwendet den gebundenen Ownership-Principal

- **GIVEN** ein bestehender Inhalt besitzt einen DataProvider
- **AND** dessen konfliktfreie Bindung weist auf den persönlichen Principal des Actors oder die aktive Organisation
- **AND** Permission und Ressourcen-Capability erlauben die Bearbeitung
- **WHEN** ein Benutzer die Mutation ausführt
- **THEN** verwendet das System den gebundenen Ownership-Principal für Same-Credential-Pre-Read und Write
- **AND** zeigt weiterhin den bestehenden DataProvider als ursprünglichen Inhaber
- **AND** bietet keinen freien Wechsel zum anderen Principal an

#### Scenario: Persönliches Eigentum bleibt dauerhaft persönlich

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = user` erstellt
- **WHEN** die aktive Organisation, deren Autorenrichtlinie oder die Mitgliedschaft des Actors später wechselt
- **THEN** bleibt der bestätigte persönliche DataProvider ursprünglicher Inhaber
- **AND** überträgt Studio den Inhalt nicht auf eine Organisation

#### Scenario: Organisationseigentum bleibt dauerhaft organisatorisch

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = organization` erstellt
- **WHEN** der ursprüngliche Actor die Organisation verlässt oder sein Account gesperrt wird
- **THEN** bleibt der bestätigte Organisations-DataProvider ursprünglicher Inhaber
- **AND** können andere berechtigte Mitglieder der Organisation den Inhalt weiter verwalten

#### Scenario: Jede Schreibaktion übermittelt den Principal explizit

- **GIVEN** ein Benutzer löst Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen oder Löschen aus
- **WHEN** der Server die jeweilige Mainserver-Mutation vorbereitet
- **THEN** liegt `actingPrincipalType` explizit als `organization` oder `user` vor
- **AND** eine fehlende oder ungültige Auswahl wird vor dem Mainserver-Aufruf abgewiesen

#### Scenario: Freie Principal- oder Autorenangabe ist unzulässig

- **WHEN** ein Client statt eines erlaubten `actingPrincipalType` einen Namen, Credentials, eine DataProvider-ID, eine Account-ID oder eine Organisations-ID übermittelt
- **THEN** verwendet der Server diese Werte nicht zur Principal-, Mapping- oder Credential-Auswahl
- **AND** lehnt einen ungültigen Transportvertrag vor dem Mainserver-Aufruf ab

### Requirement: Mainserver-Inhalte bleiben bis zur automatischen Bindung credential-sichtbar bearbeitbar

Das System SHALL für `own` und `organization` `credential_visible_compatibility` ausschließlich verwenden, wenn der Resolver explizit im beobachtenden `shadow`- oder im Rollbackmodus `compatibility` läuft. Im automatischen Zielmodus SHALL eine fehlende oder konfliktbehaftete erforderliche Principal-Bindung die Mutation fail-closed ablehnen.

#### Scenario: Shadow-Modus wertet credential-sichtbaren fremden Provider aus

- **GIVEN** der Resolver läuft explizit im Shadow-Modus
- **AND** der Benutzer besitzt die passende Update-Permission
- **AND** der Mainserver liefert den Inhalt mit dem ausgewählten Credential
- **WHEN** Studio das Update ausführt
- **THEN** schränkt es die Aktion nicht anhand eines vermuteten DataProvider-Mappings ein
- **AND** verwendet es denselben Credential-Kontext für Pre-Read und Write

#### Scenario: Credential-sichtbarer Inhalt wird hart gelöscht

- **GIVEN** der relevante Scope verwendet `credential_visible_compatibility`
- **AND** der Benutzer besitzt die passende Delete-Permission
- **AND** der Same-Credential-Pre-Read ist erfolgreich
- **WHEN** der Mainserver den Hard Delete erlaubt
- **THEN** darf Studio den Inhalt löschen
- **AND** persistiert es DataProvider und weitere Audit-Metadaten aus dem Preimage
- **AND** verlangt keinen Post-Delete-Read

#### Scenario: Fehlende Delete-Permission blockiert Hard Delete

- **GIVEN** ein Inhalt ist mit dem ausgewählten Credential verfügbar
- **AND** der Benutzer besitzt keine Delete-Permission
- **WHEN** er Hard Delete anfordert
- **THEN** lehnt Studio die Aktion vor dem Mainserver-Aufruf ab
- **AND** leitet aus Update- oder Read-Rechten kein Löschrecht ab

#### Scenario: Abweichender Principal ersetzt den Ownership-Principal nicht

- **GIVEN** ein Inhalt ist konfliktfrei an den DataProvider der aktiven Organisation gebunden
- **WHEN** ein Client für die Mutation `actingPrincipalType = user` übermittelt
- **THEN** weist Studio den abweichenden Principal vor dem Write zurück
- **AND** autorisiert weder die Organisationsprojektion noch eine persönliche Read-Sicht diese Mutation

### Requirement: Freies GraphQL-author bleibt nicht autoritative Legacy-Metadatum

Das System SHALL bestehende freie GraphQL-`author`-Werte bei Updates serverseitig unverändert erhalten, SHALL sie nicht mehr als redaktionell bearbeitbares Feld anbieten und SHALL sie bei neuen Mainserver-Inhalten nicht setzen. Der Wert SHALL weder Inhaber, sichtbaren kanonischen Autor, Mutationsprincipal, Principal-Bindung, Credential-Quelle, Audit noch IAM-Autorisierung bestimmen.

#### Scenario: Update erhält einen bestehenden Legacy-author

- **GIVEN** ein bestehender News- oder Generic-Item-Inhalt enthält einen freien GraphQL-`author`-Wert
- **WHEN** der Inhalt im Studio aktualisiert wird
- **THEN** liest und erhält der serverseitige Adapter den vorhandenen Wert innerhalb des bestätigten Read-/Write-Vertrags
- **AND** die Oberfläche bietet ihn nicht als bearbeitbare Autorenidentität an

#### Scenario: Neuer Inhalt setzt keinen freien author

- **WHEN** das Studio einen neuen Mainserver-Inhalt erstellt
- **THEN** setzt es keinen freien GraphQL-`author`-Wert
- **AND** verwendet es den bestätigten DataProvider als ursprünglichen Inhaber und sichtbaren Autor

## MODIFIED Requirements

### Requirement: Sichtbare Autorenanzeige ist von Ownership getrennt

Das System SHALL die sichtbare Autorenanzeige eines lokalen Inhalts als fachliche Inhaltsmetadaten modellieren und von technischer IAM-Ownership trennen. Für Mainserver-basierte Inhalte SHALL der bestätigte GraphQL-`dataProvider` den ursprünglichen Inhaber und sichtbaren Autor bestimmen.

Bei lokalen Inhalten SHALL `ownerUserId` und `ownerOrganizationId` ausschließlich Autorisierung und technische Zuständigkeit steuern. Bei Mainserver-Inhalten dürfen diese Felder nur aus einer konfliktfreien automatischen DataProvider-Bindung als rekonstruierbare IAM-Projektion abgeleitet werden. Ein freier `author`-String, aktueller Credential-Kontext, Actor oder lokale History-Metadaten SHALL keinen Mainserver-Inhaber begründen.

#### Scenario: Lokaler Inhalt wird mit Organisationsanzeige angelegt

- **GIVEN** ein Actor legt im aktiven Organisationskontext einen lokalen Inhalt an
- **WHEN** keine abweichende Autorenanzeige gewählt wird
- **THEN** setzt das System technische Ownership aus dem aktiven Kontext
- **AND** setzt die sichtbare Autorenanzeige standardmäßig auf die Organisation, sofern eine Organisation verfügbar ist

#### Scenario: Organisation erzwingt Organisationsanzeige für lokalen Inhalt

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** ein Benutzer persönliche Autorenanzeige für einen lokalen Inhalt speichern möchte
- **THEN** weist das System die Änderung mit einem Validierungsfehler ab
- **AND** technische Ownership bleibt unverändert

#### Scenario: Persönliche Anzeige ist für lokalen Inhalt zulässig

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **AND** der Actor ist für persönliche Anzeige zulässig
- **WHEN** der Actor persönliche Autorenanzeige auswählt
- **THEN** speichert das System den Modus getrennt von `ownerUserId` und `ownerOrganizationId`
- **AND** spätere Ownership-Änderungen ändern die Anzeige nicht stillschweigend

#### Scenario: Mainserver liefert den ursprünglichen Inhaber

- **GIVEN** ein Mainserver-Inhalt besitzt einen DataProvider
- **WHEN** Studio Inhalt oder Listenprojektion anzeigt
- **THEN** verwendet es Namen und Identität dieses DataProviders als ursprünglichen Inhaber und sichtbaren Autor
- **AND** lokale Owner-Projektionen oder ein abweichender `author`-String überschreiben die Anzeige nicht

#### Scenario: Fehlende Principal-Bindung erfindet keinen lokalen Inhaber

- **GIVEN** die aktuelle Credential-Version besitzt keine konfliktfreie Identity-Bindung
- **WHEN** Studio einen Mainserver-Inhalt anzeigt oder autorisiert
- **THEN** zeigt es den Content-DataProvider soweit vorhanden an
- **AND** erfindet keine lokale Owner-Zuordnung
- **AND** lehnt der automatische Resolver eine Scope-Mutation fail-closed ab

### Requirement: Featured Projects verwenden den host-owned Autorenvertrag

Das System MUST für jedes Featured Project genau einen ursprünglichen Inhaber und sichtbaren Autor als Organisation oder Person führen. Der bestätigte Mainserver-`dataProvider` MUST diese Identität bestimmen. Die aktive Organisationsrichtlinie MUST den Create-Principal serverseitig begrenzen; bei Bestandsmutationen MUST die konfliktfreie Ownership-Bindung den Principal bestimmen. Der Mainserver-Wert `author` und lokale Projects-Autorenmetadaten dürfen weder DataProvider-Identität noch automatische Principal-Bindung ersetzen.

#### Scenario: Organisation erstellt ein Featured Project

- **GIVEN** die aktive Autorenrichtlinie verlangt oder erlaubt organisatorisches Handeln
- **WHEN** ein Projekt mit `actingPrincipalType = organization` angelegt wird
- **THEN** verwendet der Server die Credentials der aktiven Organisation
- **AND** übernimmt den bestätigten Organisations-DataProvider als ursprünglichen Inhaber
- **AND** bestätigt ausschließlich die vor dem Create verifizierte Organisationsbindung

#### Scenario: Persönlicher Create ist nicht zulässig

- **GIVEN** die aktive Autorenrichtlinie erlaubt ausschließlich organisatorisches Handeln
- **WHEN** ein Benutzer `actingPrincipalType = user` übermittelt
- **THEN** weist der Server die Mutation vor der Mainserver-Persistenz ab

#### Scenario: Project-Update ändert weder Inhaber noch Mapping

- **GIVEN** ein Featured Project besitzt einen bestätigten DataProvider
- **WHEN** ein berechtigter Benutzer das Projekt mit einem zulässigen Mutationsprincipal bearbeitet
- **THEN** bleibt der bestehende DataProvider der ursprüngliche Inhaber
- **AND** erzeugt das Update kein Mapping des Mutationsprincipal
- **AND** lokale Projects-Autorenmetadaten werden weder als Inhaber geprüft noch neu geschrieben
