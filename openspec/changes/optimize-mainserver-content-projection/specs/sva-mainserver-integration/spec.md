## ADDED Requirements

### Requirement: Mainserver-Projektionslisten verwenden minimale typisierte Abfragen

Das System MUST für News, Events, POIs, Generic Items einschließlich FAQs und Surveys dedizierte typisierte Projection-List-Adapter verwenden, die nur Identität, Tabellendarstellung, erforderliche Zeit-/Statusfelder, minimale Quellmetadaten und sichere Diagnose laden.

Die Adapter MUST die im Design festgelegte Feld-Allowlist einhalten und dürfen keine fachliche Detail-Payload selektieren. Solange `payload_json` im gemeinsamen Tabellenvertrag nicht nullable ist, MUST der Mainserver-Projektionspfad dort ein leeres Objekt persistieren.

Die vollständigen Fachlisten-, Detail- und Mutationsadapter MUST ihre bestehenden snapshot-gestützten Verträge behalten und dürfen durch die reduzierten Projektions-Selections keine Felder verlieren.

#### Scenario: Projektionsrefresh lädt nur benötigte Felder

- **WENN** der Host einen typweiten Mainserver-Projektionsrefresh ausführt
- **DANN** verwendet er den dedizierten Projection-List-Adapter des Inhaltstyps
- **UND** dessen GraphQL-Selection entspricht exakt der typbezogenen Feld-Allowlist
- **UND** persistiert der Projektionspfad ein leeres `payload_json`, ohne dafür fachliche Payload-Felder zu laden
- **UND** lädt sie keine ausschließlich für Detailansicht oder Editor benötigten verschachtelten Felder

#### Scenario: Fachdetail bleibt vollständig

- **WENN** ein Fachplugin eine vollständige Liste, Detailansicht oder Mutation für einen Mainserver-Inhalt lädt
- **DANN** verwendet es weiterhin den vollständigen typisierten Fachadapter
- **UND** stehen alle bisher spezifizierten snapshot-gestützten Felder zur Verfügung

#### Scenario: Selection wächst unbeabsichtigt

- **WENN** ein neues Detailfeld in einen Projection-List-GraphQL-Vertrag aufgenommen wird
- **DANN** verlangt der Selection-Allowlist-Test eine explizite fachliche Begründung
- **UND** verhindert der Test, dass vollständige Detailfragmente still in den Vollscan gelangen

### Requirement: Mainserver-Projektion akzeptiert fehlende Veröffentlichungsdaten typübergreifend

Das System MUST Mainserver-Inhalte aller unterstützten projizierten Inhaltstypen auch dann materialisieren, wenn `publicationDate`, `publishedAt` oder semantisch entsprechende fachliche Veröffentlichungszeitpunkte fehlen.

Der Host MUST fehlende Veröffentlichungszeitpunkte als optionalen Wert normalisieren und darf weder einen einzelnen Datensatz noch den gesamten Typ-Snapshot allein deshalb ablehnen. Er MUST weiterhin unverzichtbare Strukturfelder wie eine stabile Quell-ID deterministisch validieren.

#### Scenario: News besitzt kein Veröffentlichungsdatum

- **GIVEN** eine Mainserver-News enthält weder `publicationDate` noch `publishedAt`
- **WHEN** der Projection-List-Adapter den Datensatz mappt
- **THEN** wird die News mit optionalem `publishedAt` in die lokale Projektion aufgenommen
- **AND** der Refresh setzt die Verarbeitung derselben und folgender Seiten fort

#### Scenario: Anderer Inhaltstyp besitzt keinen Veröffentlichungszeitpunkt

- **GIVEN** ein Event, POI, Generic Item, FAQ oder Survey enthält keinen fachlichen Veröffentlichungszeitpunkt
- **WHEN** der jeweilige Projection-List-Adapter den Datensatz mappt
- **THEN** wird der Inhalt ohne erfundenes Veröffentlichungsdatum materialisiert
- **AND** bleiben vorhandene Erstellungs-, Änderungs-, Status- und Sichtbarkeitsinformationen erhalten

#### Scenario: Unverzichtbare Quell-ID fehlt

- **GIVEN** ein Mainserver-Datensatz enthält keine stabile Quell-ID
- **WHEN** der Projection-List-Adapter ihn validiert
- **THEN** materialisiert der Host nur diesen Datensatz nicht
- **AND** erhöht er `skippedInvalidCount`
- **AND** verarbeitet er valide Datensätze derselben und folgender Seiten weiter
- **AND** protokolliert er Inhaltstyp, Seite und sichere Fehlerklasse ohne Secrets, PII oder Payload

#### Scenario: Page-Struktur ist unbrauchbar

- **GIVEN** eine Mainserver-Response besitzt keine validierbare Page-Struktur oder keine erforderlichen Pagination-Kontrollinformationen
- **WHEN** der Projection-List-Adapter die Response validiert
- **THEN** behandelt der Host die gesamte Seite als fehlgeschlagen
- **AND** finalisiert oder bereinigt er den unvollständigen Snapshot nicht destruktiv

### Requirement: Mainserver-Projektionsrefresh stellt partielle Snapshots progressiv bereit

Das System MUST jede erfolgreich geladene Seite transaktional persistieren und einen erstmaligen Typ-Snapshot nach der ersten erfolgreich persistierten Seite als partiell lesbar bereitstellen, während weitere Seiten im Hintergrund geladen werden.

Vollständigkeit, endgültiger Löschabgleich und endgültige Trefferzahl dürfen erst nach der erfolgreich verarbeiteten letzten Seite und atomarer Bestätigung der weiterhin führenden `refresh_run_id` zugesichert werden.

Der persistierte Sync-State MUST die Zustände `empty`, `partial_running`, `partial_failed`, `complete_fresh`, `complete_refreshing` und `complete_failed` unterscheiden und mindestens Refresh-Run-ID, Phase, abgeschlossene Seite, verfügbare Anzahl, Finalitätskennzeichen und den letzten sicheren Page-Fehler führen.

#### Scenario: Refresh beginnt für einen vollständigen vorhandenen Snapshot

- **GIVEN** ein vollständiger lesbarer Snapshot existiert
- **WHEN** ein neuer Refresh beginnt
- **THEN** wechselt sein Zustand auf `complete_refreshing`
- **AND** bleiben die vorhandenen Zeilen lesbar
- **AND** erhält der Lauf eine neue scope-isolierte `refresh_run_id`

#### Scenario: Erster Snapshot wird partiell lesbar

- **GIVEN** noch kein vollständiger Snapshot existiert
- **WHEN** die erste nichtleere Seite erfolgreich persistiert wurde
- **THEN** wechselt der Zustand auf `partial_running`
- **AND** entsprechen `available_count` und `completed_page` dem persistierten Fortschritt
- **AND** bleibt `is_total_final = false`

#### Scenario: Erste Seite eines erstmaligen Refreshs ist persistiert

- **GIVEN** für einen Mainserver-Inhaltstyp existiert noch kein vollständiger Snapshot
- **WHEN** die erste nichtleere Seite erfolgreich persistiert wurde
- **THEN** liefert `GET /api/v1/iam/contents` die autorisierten Zeilen dieser Seite aus
- **AND** kennzeichnen die Metadaten den Snapshot als partiell und den Refresh als laufend
- **AND** blockiert ein expliziter Typfilter die bereits vorhandenen Zeilen nicht mit einem Missing-Snapshot-Fehler

#### Scenario: Spätere Seite schlägt fehl

- **GIVEN** mindestens eine Seite eines Typ-Refreshs wurde erfolgreich persistiert
- **WHEN** eine spätere Seite fehlschlägt
- **THEN** bleiben die erfolgreich persistierten Zeilen als partieller Snapshot lesbar
- **AND** kennzeichnen die Sync-Metadaten den letzten Page-Fehler und die unvollständige Gesamtmenge
- **AND** führt der Host keinen abschließenden Löschabgleich gegen die unvollständige Quellmenge aus

#### Scenario: Letzte Seite schließt den Snapshot ab

- **GIVEN** alle Seiten eines Typ-Refreshs wurden erfolgreich geladen und persistiert
- **WHEN** der Host den Lauf finalisiert
- **THEN** führt er den Löschabgleich für nicht mehr vorhandene Quellzeilen aus
- **AND** markiert den Snapshot als vollständig und frisch
- **AND** liefert eine endgültige Trefferzahl und Pagination-Metadaten

#### Scenario: Ältere Refresh-Generation erreicht verspätet das Ende

- **GIVEN** ein neuerer Lauf oder ein gezieltes Mutation-Update hat die führende `refresh_run_id` eines Scopes ersetzt
- **WHEN** eine ältere Reconciliation ihre letzte Seite verarbeitet
- **THEN** darf sie weder den Snapshot finalisieren noch Projektionszeilen löschen
- **AND** beendet sie sich ohne weitere Zustandswirkung

#### Scenario: Gezieltes Mutation-Update trifft während Reconciliation ein

- **GIVEN** eine Reconciliation desselben Projektions-Scopes läuft
- **WHEN** ein gezieltes Mutation-Upsert oder Identity-Delete beginnt
- **THEN** invalidiert der Host die ältere Reconciliation-Generation vor der lokalen Änderung
- **AND** kann der ältere Lauf die gezielte Änderung weder überschreiben noch beim Finalisieren löschen

#### Scenario: Mainserver bestätigt einen leeren Typ

- **GIVEN** die erste Seite enthält keine Datensätze
- **WHEN** der Mainserver zugleich belastbar `hasNextPage = false` meldet
- **THEN** finalisiert der Host einen vollständigen leeren Snapshot
- **AND** behandelt er die leere Seite nicht als unbekannten oder dauerhaft partiellen Zustand

### Requirement: Mainserver-Projektionsrefresh begrenzt sequenzielle Roundtrips

Das System MUST die Seitengröße des schlanken, upstream-paginierbaren Projektionspfads für News, Events, POIs und Generic Items einschließlich FAQs nach nachgewiesener Mainserver-Kompatibilität auf 100 Datensätze festlegen oder eine dokumentierte kompatible Fallback-Größe verwenden.

Die Round-Robin-Reihenfolge zwischen sichtbaren Inhaltstypen MUST erhalten bleiben, damit ein großer Typ die erste partielle Seite anderer Typen nicht blockiert.

Surveys MUST von diesem Vertrag ausgenommen bleiben, weil der bestätigte Mainserver-Vertrag für `surveys` keine serverseitige Pagination anbietet. Der Survey-Adapter MUST seine Selection reduzieren, darf lokale Pagination aber nicht als Reduktion der Upstream-Requests darstellen.

#### Scenario: Großer News-Bestand wird projiziert

- **GIVEN** der Mainserver liefert 582 News und unterstützt `pageSize = 100`
- **WHEN** der Host einen vollständigen Projection-List-Refresh ausführt
- **THEN** benötigt er höchstens sechs erfolgreiche News-Page-Requests
- **AND** persistiert er jede Seite vor dem nächsten Round-Robin-Schritt

#### Scenario: Mehrere Typen werden gleichzeitig aufgebaut

- **GIVEN** mehrere sichtbare Mainserver-Inhaltstypen besitzen noch keinen Snapshot
- **WHEN** der progressive Refresh beginnt
- **THEN** versucht der Coordinator die erste Seite jedes sichtbaren Typs, bevor er dessen nächste Seite lädt
- **AND** kann jeder erfolgreich persistierte Typ unabhängig partiell gelesen werden

#### Scenario: Surveys werden projiziert

- **GIVEN** der bestätigte Mainserver-Vertrag bietet für `surveys` weder `limit`/`skip` noch Cursor-Pagination
- **WHEN** der Host Surveys für die Projektion lädt
- **THEN** verwendet er eine schlanke Survey-Selection in einem vollständigen Upstream-Abruf
- **AND** wendet er `pageSize = 100`, partielle Upstream-Seiten und Round-Robin-Fortsetzung nicht auf Surveys an

### Requirement: Hot-Refresh priorisiert die neuesten Inhalte

Das System MUST bei einem manuellen oder interaktiven Refresh zuerst die neueste Projektionsseite jedes angefragten upstream-paginierbaren Inhaltstyps laden und persistieren. Die vollständige Reconciliation MUST anschließend entkoppelt im Hintergrund fortgesetzt werden, sofern sie nicht bereits anderweitig läuft. Für Surveys MUST der einzelne vollständige Upstream-Abruf als typspezifische Hot-Phase gelten.

#### Scenario: Redakteur startet einen Refresh

- **WHEN** ein Redakteur die Aktualisierung mehrerer Inhaltstypen startet
- **THEN** lädt der Coordinator in der Hot-Phase zuerst die neueste Seite jedes angefragten Typs
- **AND** persistiert jede erfolgreiche Seite sofort
- **AND** beantwortet er den interaktiven Request nach Abschluss der Hot-Phase mit dem Zustand der Typen
- **AND** wartet die Antwort nicht auf den vollständigen historischen Scan

#### Scenario: Reconciliation läuft nach der Hot-Phase weiter

- **GIVEN** die Hot-Phase wurde erfolgreich abgeschlossen
- **AND** ältere Quellseiten müssen noch geprüft werden
- **WHEN** der interaktive Request bereits beantwortet wurde
- **THEN** setzt ein entkoppelter Lauf die vollständige Reconciliation fort
- **AND** bleiben die Ergebnisse der Hot-Phase währenddessen lesbar

### Requirement: Projektionsrefresh verwendet nur bestätigte Mainserver-Verträge

Das System MUST für die bestehende Mainserver-Integration vollständige Reconciliation statt eines Delta-Wasserstands verwenden. Es MUST Offset-Pagination nicht als verlustfreien Delta-Sync behandeln und darf ohne bestätigten authentisierten Mainserver-Ereignisvertrag keinen Event-Ingress exponieren.

#### Scenario: Schneller Refresh wird geplant

- **GIVEN** die relevanten Mainserver-Listen bieten keinen stabilen Filter oder Cursor nach `(updatedAt, id)`
- **WHEN** der Coordinator einen schnellen Refresh plant
- **THEN** verwendet er die Hot-Phase mit anschließender vollständiger Reconciliation
- **AND** speichert er keinen vermeintlich verlustfreien Delta-Wasserstand

#### Scenario: Externe Mainserver-Änderung erfolgt

- **GIVEN** der bestätigte Mainserver-Vertrag bietet weder GraphQL-Subscriptions noch einen authentisierten Webhook- oder Message-Bus-Vertrag
- **WHEN** Inhalte außerhalb des Studios geändert oder gelöscht werden
- **THEN** erkennt die nächste vollständige Reconciliation diese Änderung
- **AND** exponiert Studio keinen unbestätigten Mainserver-Ereignisendpunkt

### Requirement: Gezielte Änderungen bleiben der schnellste Projektionspfad

Das System MUST die vorhandenen gezielten Mutation-Projection-Loader für News, Events, POIs, Generic Items und FAQs wiederverwenden und den Vertrag auf Surveys sowie weitere projizierte Typen mit verfügbarer Detailquelle erweitern. Ein erfolgreicher Fachschreibvorgang MUST nicht auf einen nachgelagerten vollständigen Projektionsrefresh warten.

#### Scenario: Unterstützte Studio-Mutation ist erfolgreich

- **WHEN** eine Mutation einen einzelnen Mainserver-Inhalt erfolgreich erstellt, ändert oder löscht
- **THEN** aktualisiert oder entfernt der Host ausschließlich die zugehörige lokale Projektionszeile über den typisierten Detailpfad
- **AND** bleibt eine spätere vollständige Reconciliation das Sicherheitsnetz

#### Scenario: Survey wird im Studio geändert

- **GIVEN** für Surveys steht eine stabile Detailquelle zur Verfügung
- **WHEN** eine Survey-Mutation erfolgreich endet
- **THEN** aktualisiert der Host die betroffene Survey-Projektionszeile gezielt
- **AND** startet er nicht allein deshalb einen blockierenden Vollrefresh des Survey-Bestands

## MODIFIED Requirements

### Requirement: Complete NewsItem Snapshot Coverage

The system SHALL model the SVA Mainserver `NewsItem` GraphQL object with complete snapshot-backed field coverage in the server-only Mainserver adapter layer.

The typed full News adapter SHALL select and map all stable `NewsItem` fields from the checked-in schema snapshot: `id`, `title`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `payload`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `visible`, `createdAt`, `updatedAt`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, and `pushNotificationsSentAt`.

The dedicated News Projection-List adapter SHALL use a smaller typed selection and SHALL treat both `publicationDate` and `publishedAt` as optional.

#### Scenario: Full NewsItem is loaded

- **GIVEN** the Mainserver returns a `NewsItem` containing scalar, nested, read-only, and nullable fields
- **WHEN** Studio maps the response through the full adapter in `@sva/sva-mainserver/server`
- **THEN** all snapshot-backed fields are represented in the typed News DTO
- **AND** nullable optional fields are normalized deterministically without rejecting the entire response
- **AND** read-only fields are preserved for plugin display or diagnostics

#### Scenario: Mainserver omits optional NewsItem fields

- **GIVEN** the Mainserver returns a valid `NewsItem` with missing optional nested or publication fields
- **WHEN** the full or Projection-List adapter maps the response
- **THEN** missing optional fields are represented as `undefined`, empty arrays, or documented defaults
- **AND** a stable identifier remains required
- **AND** missing `publicationDate` and `publishedAt` do not reject the item or its containing page
