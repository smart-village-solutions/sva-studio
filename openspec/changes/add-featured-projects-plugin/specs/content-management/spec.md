## ADDED Requirements

### Requirement: Featured Projects sind eigenständige GenericItem-Fachinhalte

Das System MUST Featured Projects als eigenständigen Content-Type `projects.project` bereitstellen und als GenericItem mit `genericType` gleich `PROJECT` speichern. Die gemeinsame Inhaltsübersicht MUST diese Datensätze ausschließlich als `projects.project` darstellen.

#### Scenario: Featured Project wird angelegt

- **WHEN** ein Benutzer mit `projects.create` ein Featured Project anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `PROJECT`
- **AND** projiziert ihn als `projects.project`

#### Scenario: Featured Project erscheint nicht doppelt

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint es als `projects.project`
- **AND** nicht zusätzlich als `generic-items.generic-item`

### Requirement: Featured Projects besitzen einen eigenständigen API-Vertrag

Das System MUST je Featured Project `Id`, `Language`, `Title`, `Description`, `FullText`, `Images`, `Status`, `Published`, `PublishedAt`, `Author`, `Deleted`, `CreatedAt` und `UpdatedAt` bereitstellen. Der host-owned `Status` MUST die führende redaktionelle Information sein; `Published` MUST ein nur lesbares, daraus abgeleitetes Feld sein. `Author` MUST genau eine Organisation oder Person repräsentieren und von technischer Ownership getrennt bleiben. Die Projekte-Collection MUST ausschließlich Featured Projects enthalten und darf kein `Type`-, `Translations`-, `ImageUrl`-, `ImageCaption`- oder `ImageCredits`-Feld ausgeben.

#### Scenario: Vollständiges Featured Project wird gelesen

- **WHEN** ein berechtigter Benutzer ein Featured Project liest
- **THEN** enthält die Antwort genau den fachlichen FeaturedProject-Vertrag
- **AND** enthält sie weder ein Typfeld noch Übersetzungsverknüpfungen oder abgelöste Einzelbildfelder

#### Scenario: Sprachfassungen bleiben unabhängig

- **GIVEN** mehrere Featured Projects verwenden unterschiedliche oder gleiche Werte in `Language`
- **WHEN** eines dieser Projekte geändert oder gelöscht wird
- **THEN** verändert das System keinen anderen Datensatz
- **AND** führt keinen Sprach-Fallback aus

### Requirement: Featured Projects validieren ihre redaktionellen Pflichtfelder

Das System MUST `Language`, `Title`, `Description`, `FullText` und `Status` als Pflichtfelder behandeln. `Language` MUST ein nicht leerer, getrimmter und jederzeit editierbarer Freitext ohne feste Werteliste sein. `FullText` MUST Rich Text unterstützen.

#### Scenario: Beliebiges Sprachkürzel wird gespeichert

- **WHEN** ein Benutzer einen nicht leeren freien Wert in `Language` eingibt
- **THEN** speichert das System den getrimmten Wert ohne Wertelisten- oder BCP-47-Prüfung

#### Scenario: Pflichtfeld fehlt

- **WHEN** `Language`, `Title`, `Description` oder `FullText` leer übermittelt wird
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Featured Projects bilden den host-owned Lifecycle abwärtskompatibel auf GenericItem ab

Das System MUST den host-owned Lifecycle-Status eines Featured Projects für den unveränderten Mainserver-Transport als `payload.status` mit `draft`, `published` oder `archived` spiegeln. Der Payload-Wert darf den host-owned Core-Status nicht ersetzen oder abweichend definieren. Der Adapter MUST `visible` deterministisch auf `true` nur für `published` sowie auf `false` für `draft` und `archived` abbilden. Bei `published` MUST der Host konsistente Veröffentlichungsmetadaten einschließlich `PublishedAt` verwalten. Dieser Change MUST die Abbildung ausschließlich für Featured Projects aktivieren.

#### Scenario: Neues Projekt beginnt als Entwurf

- **WHEN** ein Featured Project ohne bestehenden Status angelegt wird
- **THEN** setzt das System `payload.status` auf `draft`
- **AND** setzt es `visible` auf `false`
- **AND** gibt es `Published` als `false` aus

#### Scenario: Projekt wird veröffentlicht

- **WHEN** ein Benutzer den Projektstatus auf `published` setzt
- **THEN** speichert das System `payload.status` als `published`
- **AND** setzt es `visible` auf `true`
- **AND** gibt es `Published` als `true` aus
- **AND** setzt oder erhält einen konsistenten `PublishedAt`-Wert

#### Scenario: Projekt wird archiviert

- **WHEN** ein Benutzer den Projektstatus auf `archived` setzt
- **THEN** speichert das System `payload.status` als `archived`
- **AND** setzt es `visible` auf `false`
- **AND** gibt es `Published` als `false` aus

#### Scenario: Bestehender GenericItem-Fachtyp besitzt keinen Payload-Status

- **GIVEN** ein bestehender GenericItem-, FAQ- oder Kacheldatensatz besitzt kein `payload.status`
- **WHEN** der Host seinen redaktionellen Status darstellt
- **THEN** leitet er ihn weiterhin als Entwurf oder veröffentlicht aus `visible` ab
- **AND** migriert oder verändert diesen Datensatz nicht automatisch

#### Scenario: Mutation enthält das abgeleitete Feld Published

- **WHEN** ein Client `Published` als Mutationseingabe übermittelt
- **THEN** weist das System das nicht beschreibbare Feld zurück
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Featured Projects verwenden den host-owned Autorenvertrag

Das System MUST für jedes Featured Project genau einen sichtbaren Autor als Organisation oder Person führen. Autorenanzeige und technische Ownership MUST getrennt bleiben. Die aktive Organisationsrichtlinie MUST serverseitig gelten; der Mainserver-Wert `author` darf die host-owned Autorenart und Referenz nicht ersetzen.

#### Scenario: Organisation ist sichtbarer Autor

- **GIVEN** die aktive Autorenrichtlinie verlangt oder erlaubt die Organisation als Autor
- **WHEN** ein Projekt angelegt wird
- **THEN** speichert der Host genau die Organisation als sichtbaren Autor
- **AND** setzt er keine zusätzliche Person als zweiten Autor

#### Scenario: Persönlicher Autor ist nicht zulässig

- **GIVEN** die aktive Autorenrichtlinie erlaubt ausschließlich die Organisation
- **WHEN** ein Benutzer eine Person als sichtbaren Autor übermittelt
- **THEN** weist der Host die Mutation vor der Mainserver-Persistenz ab

### Requirement: Featured Projects besitzen eine geordnete optionale Bildergalerie

Das System MUST null oder mehr Bilder in einer stabilen Reihenfolge verwalten. Jedes Bild MUST `Url`, `AltText` und `Position` besitzen; `Caption` und `Credits` sind optional. Das erste Bild MUST als Titel- und Vorschaubild gelten.

#### Scenario: Mehrere Bilder werden sortiert

- **WHEN** ein Benutzer mehrere gültige Bilder speichert oder umsortiert
- **THEN** persistiert das System sie in der gewählten Reihenfolge
- **AND** gibt lückenlose Positionen entsprechend dieser Reihenfolge zurück
- **AND** verwendet das Bild an erster Position als Titel- und Vorschaubild

#### Scenario: Bildmetadaten sind unvollständig

- **WHEN** ein vorhandenes Bild keine URL oder keinen Alternativtext besitzt
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: Verborgene GenericItem-Felder bleiben erhalten

Das System MUST alle nicht im FeaturedProject-Modell sichtbaren GenericItem-Felder bei Aktualisierungen über den Studio-Schreibpfad auf Basis des unmittelbar zuvor gelesenen Datensatzes erhalten. Das Ausblenden eines Feldes darf seinen vorhandenen Wert weder löschen noch zurücksetzen. Der Vertrag MUST keine konfliktfreie Zusammenführung paralleler externer Änderungen versprechen, solange der Mainserver keine Revision oder vergleichbare Vorbedingung unterstützt.

#### Scenario: Projekt mit verborgenen Bestandsdaten wird aktualisiert

- **GIVEN** ein Projekt besitzt Werte in einem nicht sichtbaren GenericItem-Feld oder unbekannte Payload-Schlüssel
- **WHEN** ein Benutzer ein sichtbares Projektfeld ändert
- **THEN** speichert das System die Änderung
- **AND** erhält alle nicht kontrollierten Bestandswerte unverändert

### Requirement: Featured Projects werden intern weich gelöscht

Das System MUST `Deleted` im Studio-Vertrag systemverwaltet führen. Eine autorisierte Studio-Löschaktion MUST den Datensatz über `payload.deleted` als gelöscht markieren und aus aktiven Studio-Listen sowie -Projektionen entfernen, ohne `Deleted` als editierbares Formularfeld anzubieten. Diese Anforderung darf keine globale Löschgarantie für externe Mainserver-Clients behaupten.

#### Scenario: Featured Project wird gelöscht

- **WHEN** ein Benutzer mit `projects.delete` ein aktives Featured Project löscht
- **THEN** markiert das System den Datensatz intern als gelöscht
- **AND** entfernt ihn aus der aktiven Projekte-Collection und Inhaltsprojektion

#### Scenario: Fremdtyp wird über Projekte-Endpunkt gelöscht

- **WHEN** eine ID eines anderen GenericItem-Typs an den Projekte-Löschpfad übermittelt wird
- **THEN** behandelt das System die ID wie eine unbekannte Projekt-ID
- **AND** führt keine Mutation aus

