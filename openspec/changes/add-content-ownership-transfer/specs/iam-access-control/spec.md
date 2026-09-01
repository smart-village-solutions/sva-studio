## ADDED Requirements

### Requirement: Content-Inhabertransfer besitzt eine separate Permission

Das System SHALL die fully-qualified Action `content.transferOwnership` als eigenständige tenantweite und scope-fähige Permission im kanonischen Permission-Katalog führen. Normale Inhalts-Update-, Publish-, Archive-, Restore- oder Delete-Permissions SHALL diese Action weder einschließen noch implizit ersetzen.

#### Scenario: Update-Recht reicht für Transfer nicht aus

- **GIVEN** ein Benutzer besitzt `content.updateMetadata` mit Scope `all`
- **AND** besitzt kein `content.transferOwnership`
- **WHEN** er einen lokalen oder Mainserver-basierten Inhabertransfer anfordert
- **THEN** verweigert die zentrale Autorisierung die Action
- **AND** führt der Server weder lokale noch externe Mutation aus

#### Scenario: Transfer-Scope wird gegen den Quellinhalt ausgewertet

- **GIVEN** ein Benutzer besitzt `content.transferOwnership` mit Scope `organization`
- **WHEN** er einen Inhalt der aktiven Organisation übertragen will
- **THEN** kann die Source-Autorisierung erfolgreich sein
- **AND** begründet die Zielorganisation keine zusätzliche Source-Berechtigung

#### Scenario: Eingeschränkter Scope deckt ownerlosen Inhalt nicht ab

- **GIVEN** ein Inhalt besitzt keinen auflösbaren aktuellen Inhaber
- **AND** der Benutzer besitzt `content.transferOwnership` nur mit Scope `own` oder `organization`
- **WHEN** er einen Transfer anfordert
- **THEN** verweigert die Autorisierung den Transfer fail-closed
- **AND** benötigt der Actor Scope `all`, um einen ownerlosen Inhalt zuzuweisen
- **AND** darf ein Kompatibilitäts- oder Shadow-Resolver einen engeren Scope nicht als `all` behandeln

#### Scenario: Globaler Scope ist unabhängig vom Lifecycle des bisherigen Inhabers

- **GIVEN** ein sichtbarer Inhalt besitzt einen aktuellen Owner oder Mainserver-DataProvider
- **AND** dessen bisheriger Principal ist inaktiv, gelöscht oder nicht eindeutig auflösbar
- **AND** der Actor besitzt `content.transferOwnership` mit Scope `all`
- **WHEN** der Actor einen Transfer anfordert
- **THEN** autorisiert die Source-Prüfung den aktuellen Inhalt ohne Credentials oder Aktivstatus des bisherigen Principals
- **AND** wird eine optionale Source-Principal-Bindung nicht zum Autorisierungsgate

#### Scenario: System-Admin erhält die neue Tenant-Permission

- **WHEN** der kanonische Permission-Reconcile `content.transferOwnership` materialisiert
- **THEN** erhält die geschützte Tenant-Rolle `system_admin` den verwalteten Grant mit Scope `all`
- **AND** erhalten andere Rollen keinen impliziten Grant

### Requirement: Transferziel wird unabhängig von der Source-Permission validiert

Das System SHALL ein Transferziel als aktiven Account oder aktive Organisation derselben Instanz validieren. Für Mainserver-basierte Inhalte SHALL es verwendbare Ziel-Credentials und vor dem Provider-Write eine eindeutige, konfliktfreie und aktuelle DataProvider-Bindung verlangen. Fehlt bei verwendbaren Credentials ausschließlich die gespeicherte Bindung, MAY der Zielkatalog den Principal mit dem Zustand `verification_required` anbieten. Nach ausdrücklicher Transferbestätigung SHALL der Server genau diese Credential-Version über den authentifizierten Identity-Endpunkt prüfen, die Beobachtung konfliktbewusst persistieren und die Zielbindung erneut auflösen. Die Zielvalidierung SHALL keine freie DataProvider-Auswahl und keine neue Berechtigung des Actors im Zielbereich begründen.

#### Scenario: Gültiger Account ist Transferziel

- **GIVEN** ein aktiver Account gehört zur Quellinstanz
- **AND** erfüllt für einen Mainserver-Inhalt den bestätigten Binding- und Credential-Vertrag
- **WHEN** der Server den Account als Ziel validiert
- **THEN** kann er als `targetPrincipal.type = account` verwendet werden
- **AND** bleibt die technische DataProvider-ID serverseitig

#### Scenario: Gültige Organisation ist Transferziel

- **GIVEN** eine aktive Organisation gehört zur Quellinstanz
- **AND** erfüllt für einen Mainserver-Inhalt den bestätigten Binding- und Credential-Vertrag
- **WHEN** der Server die Organisation als Ziel validiert
- **THEN** kann sie als `targetPrincipal.type = organization` verwendet werden
- **AND** erfordert dies keine Mitgliedschaft des Actors in der Zielorganisation

#### Scenario: Fehlende Zielbindung wird erst bei Bestätigung geprüft

- **GIVEN** ein aktiver Ziel-Principal derselben Instanz besitzt verwendbare Credentials
- **AND** für deren aktuellen Fingerprint fehlt eine DataProvider-Bindung
- **WHEN** der Server den Zielkatalog erstellt
- **THEN** darf er den Principal als `verification_required` anbieten
- **AND** ruft das Blättern oder Suchen nicht für jeden Treffer den externen Identity-Endpunkt auf
- **WHEN** der Benutzer den Transfer zu diesem Principal ausdrücklich bestätigt
- **THEN** prüft der Server ausschließlich dessen Credentials über `/data_provider.json`
- **AND** persistiert die authentifizierte Beobachtung vor der erneuten Zielauflösung

#### Scenario: Zielbindung ist konfliktbehaftet

- **GIVEN** ein Ziel-Principal ist mehreren DataProvidern zugeordnet oder seine Binding-Evidenz ist stale
- **WHEN** ein Mainserver-Transfer vorbereitet wird
- **THEN** verweigert der Server die Zielvalidierung
- **AND** offenbart er weder konkurrierende Principal-Daten noch Credentials

#### Scenario: Anlassbezogene Identity-Prüfung scheitert

- **GIVEN** ein ausgewähltes Ziel benötigt noch eine DataProvider-Verifikation
- **WHEN** `/data_provider.json` keine verwendbare Identität liefert oder nicht erreichbar ist
- **THEN** endet der Transfer mit einem stabilen, wiederholbaren Verifikationsfehler
- **AND** führt der Server keinen Provider-Write aus

#### Scenario: Browser sendet eine DataProvider-ID

- **WHEN** ein Client eine freie `dataProviderId` an den Studio-Transferendpunkt sendet
- **THEN** lehnt das Request-Schema den Wert ab
- **AND** wird keine Mainserver-Mutation vorbereitet
