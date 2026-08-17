## 1. Spezifikations- und Konfliktbaseline

- [x] 1.1 Den vollständigen Ist-Vertrag von `update-content-media-overlay-flow`, `add-single-file-media-upload`, `add-media-async-processing` und `extend-media-management-governance` gegen diesen Change prüfen und den bisherigen Content-Upload-Abbruchsvertrag eindeutig superseden; `/admin/media` bleibt außerhalb des verzögerten Flows.
- [x] 1.2 Den aktuellen Upload-/Listing-/Delivery-/Reference-Code sowie alle sechs Content-Adapter mit Characterization-Tests gegen sofortige Asset-Erzeugung und die heutige Save-Reihenfolge fixieren.
- [x] 1.3 Die Delta-Specs für `content-management` und `media-management` nach Review dieses Designs finalisieren.
- [x] 1.4 `openspec validate delay-content-media-persistence --strict` erfolgreich ausführen.

## 2. Datenmodell und Repository-Verträge

- [x] 2.1 Vor der Schemaänderung `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` gegen die aktuelle Medienbaseline prüfen.
- [x] 2.2 Eine additive Goose-Migration für fachlichen Asset-Lifecycle, Content-Media-Save-Operationen, gewünschte Referenzen, Actor-/Tenant-Bindung, sichere Fehlercodes, Leases, Ablaufzeiten, Constraints und Indizes erstellen; Bestandsassets auf `active` abbilden.
- [x] 2.3 Strikte TypeScript-Typen und Repository-Mapper für Operation, Status, Referenzentwurf und provisorische Asset-Ownership ergänzen; keine freien Statusstrings in Service- oder UI-Verträgen verwenden.
- [x] 2.4 Transaktionale Repository-Operationen für Begin/Advance, idempotente lokale Asset-Zuordnung, bestätigten Mainserver-Erfolg, Reference-Replace plus Asset-Aktivierung, Abandon-Lease und terminalen Abschluss implementieren.
- [x] 2.5 Listen und Counts standardmäßig auf aktive Assets begrenzen; provisorische Assets dürfen weder Suche, Pagination noch Picker-Gesamtzahlen beeinflussen.
- [x] 2.6 SQL-/Repository-Tests für Tenant-Isolation, Actor-Bindung, monotone Statusübergänge, konkurrierende Wiederholungen, `FOR UPDATE SKIP LOCKED` oder gleichwertige Lease-Kontrolle sowie Quota-Korrektur ergänzen.
- [x] 2.7 `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` unmittelbar nach der Migration aktualisieren.

## 3. Hostseitiger Medienlebenszyklus

- [x] 3.1 Media-Initialisierung um einen expliziten Upload-Kontext `library | content-save` und eine idempotente Operations-/Draft-ID erweitern; `library` bleibt rückwärtskompatibler Default.
- [x] 3.2 Provisorische Assets bei Initialize/Complete verarbeiten, ohne sie regulär sichtbar zu machen; Detail-, Metadata- und Delivery-Zugriff auf Instanz, Actor und Operation begrenzen.
- [x] 3.3 API-/Service-Verträge für Begin, gewünschte Referenzen, Status, Commit-Retry und Abandon bereitstellen; alle Mutationseingaben client- und serverseitig validieren.
- [x] 3.4 Reference-Replace und Aktivierung aller verwendeten provisorischen Assets in einer Studio-Datenbanktransaktion ausführen; ungenutzte Operation-Assets kontrolliert verwerfen.
- [x] 3.5 Idempotenten Cleanup für Original, Varianten, Upload-Session, Asset, Storage-Usage und Operationsdaten implementieren; bereits entfernte Teilobjekte dürfen keinen terminalen Erfolg verhindern.
- [x] 3.6 Einen begrenzten, lease-basierten Recovery-Lauf integrieren, der nur sicher verwerfbare Zustände bereinigt und `content_saved`/`outcome_unknown` niemals generisch löscht.
- [x] 3.7 Autorisierung so absichern, dass Content-Uploads `media.create` und `media.reference.manage`, aber kein `media.delete` benötigen; fremde Actor-/Tenant-Operationen bleiben fail-closed.
- [x] 3.8 Audit und OTEL für Start, Upload, Commit, Abandon, Cleanup-Fehler und Reconciliation mit redigierten IDs/Fehlercodes ergänzen; keine URLs, Dateipfade, Binärdaten oder Payloads loggen.

## 4. Mainserver-Korrelation und gemeinsame SDK-Orchestrierung

- [x] 4.1 Den Mainserver-CRUD-Client um eine optionale, typisierte Content-Media-Save-Operations-ID erweitern, ohne Plugin-Payloads oder öffentliche Mainserver-Verträge mit technischen Feldern anzureichern.
- [x] 4.2 Hostseitige Create-/Update-Routen so anbinden, dass bestätigter Upstream-Erfolg samt `targetType` und stabiler `targetId` persistent an der Operation vermerkt wird; eindeutige Ablehnung und technisch unklarer Ausgang müssen getrennt bleiben.
- [x] 4.3 `saveContentWithHostMediaReferences` zu einem gemeinsamen Orchestrator für lokale Draft-Dateien erweitern oder einen klar benannten Nachfolger bereitstellen, der Payload-Bau erst nach Upload-Auflösung ausführt.
- [x] 4.4 Ergebnisunionen für vollständigen Erfolg, Upload-Fehler, sicheren Content-Fehler, Reference-/Commit-Teilfehler, Cleanup-Pending und `outcome_unknown` definieren; Retry-Callbacks dürfen abgeschlossene Mainserver-Schritte nicht wiederholen.
- [x] 4.5 Mischfälle aus bestehenden Bibliotheksassets, manuellen URLs und neuen lokalen Dateien in einem Save unterstützen; der gewünschte Referenzsatz muss vollständig und deterministisch sortiert sein.
- [x] 4.6 Requests mit gleicher Operation/Draft-ID idempotent machen und Tests für verlorene Antworten, Doppel-Submit, Commit-Retry und Abandon-Retry ergänzen.
- [x] 4.7 Für Änderungen an `packages/{data,sva-mainserver,auth-runtime}` früh `pnpm check:server-runtime` sowie die kleinsten relevanten Type-Targets ausführen.

## 5. Gemeinsamer Browser-Draft und Overlay

- [x] 5.1 Den neutralen Medienverwendungsvertrag um einen diskriminierten lokalen Dateiquelltyp erweitern; Serializer und persistente Mapper müssen lokale `File`-/Object-URL-Werte compile-time und runtime-seitig ablehnen.
- [x] 5.2 Im gemeinsamen Overlay eine explizite Upload-Strategie implementieren: sofortig für `/admin/media`, verzögert für Content-Editoren; keine pluginlokalen Lifecycle-Flags einführen.
- [x] 5.3 Lokale Vorschau mit `URL.createObjectURL()` implementieren und URLs bei Entfernen, Ersetzen, Unmount und erfolgreichem Save exakt einmal widerrufen.
- [x] 5.4 Lokale Metadaten, Reihenfolge und Vorschau bis zum Save im Formular halten; Navigation oder Abbruch ohne Save darf keinen Media-Endpunkt aufrufen.
- [x] 5.5 Den gemeinsamen Save-Feedback-Vertrag um Upload-, Content-, Referenz-, Cleanup- und Unknown-Phasen erweitern und lokalisierte, barrierefreie Statusmeldungen bereitstellen.
- [x] 5.6 Während laufender Operation Doppel-Submit sowie konkurrierendes Entfernen/Umsortieren sperren; Fokus, Live-Region und Fehlerfokus nach Abschluss oder Fehler deterministisch wiederherstellen.
- [x] 5.7 Komponenten-/Hook-Tests für Vorschau ohne Netzwerk, Object-URL-Cleanup, Entfernen, Abbruch, Navigation, Unsupported Type, Upload-Retry und zugängliche Statuswechsel ergänzen.

## 6. Pluginweise Integration

- [x] 6.1 POI und Events als zwei unterschiedliche Mainserver-Formmodelle an den gemeinsamen Draft-/Save-Orchestrator anbinden und ihre Adapter-/Roundtrip-Tests härten.
- [x] 6.2 News einschließlich verschachtelter Content-Block-Medien und bestehender Zusatzfelder migrieren.
- [x] 6.3 Generic Items migrieren und nicht vom gemeinsamen Kern bearbeitete Blockmedien unverändert erhalten.
- [x] 6.4 Projects einschließlich `altText`, `caption`, `credits` und lückenloser Positionsableitung migrieren.
- [x] 6.5 Cockpit Cards einschließlich Pflichtbildvalidierung, festem Content-Typ und reduzierter Metadatenoberfläche migrieren.
- [x] 6.6 Nach jedem Plugin-Block dessen fokussierte Nx-Unit- und Type-Targets ausführen; auf bekannt rotem Stand nicht mit dem nächsten Plugin fortfahren.
- [x] 6.7 Nach erfolgreicher Migration aller sechs Plugins den alten sofortigen Content-Upload-Pfad und den temporären Rollout-Schalter entfernen; `/admin/media` behält den sofortigen Upload.

## 7. Integrations-, E2E- und Fehlernachweise

- [x] 7.1 Auth-Runtime-/Repository-Integrationstests für provisorische Sichtbarkeit, Aktivierung, sicheren Abandon, Cleanup-Retry, Lease-Konkurrenz und Quota-Bilanz ergänzen.
- [x] 7.2 E2E nachweisen: lokale Auswahl zeigt Vorschau, Mediathek bleibt unverändert, erfolgreicher Content-Save erzeugt genau ein aktives Asset und genau die erwartete Referenz.
- [x] 7.3 E2E nachweisen: Entfernen, Dialogabbruch und Navigation ohne Save erzeugen weder Asset noch Referenz.
- [x] 7.4 E2E nachweisen: eindeutiger Mainserver-Fehler hinterlässt kein sichtbares Asset; Cleanup-Fehler bleibt verborgen, auditierbar und wiederholbar.
- [x] 7.5 E2E nachweisen: Mainserver-Erfolg plus Reference-/Aktivierungsfehler zeigt Teilfehler und kann ohne erneuten Mainserver-Write abgeschlossen werden.
- [x] 7.6 Negative Tests für fremde Instanz, fremden Actor, fehlende `media.create`/`media.reference.manage`, unzulässige MIME-/Größenwerte und persistierte Blob-/Data-/Object-URLs ergänzen.
- [x] 7.7 Reload/Prozessabbruch während `uploading`, `saving_content` und `content_saved` simulieren und terminale Recovery-Evidenz dokumentieren.

## 8. Dokumentation und Gates

- [x] 8.1 `docs/architecture/05-building-block-view.md` um Browser-Draft, Save-Orchestrator, Operationsservice und Paketgrenzen aktualisieren.
- [x] 8.2 `docs/architecture/06-runtime-view.md` um Erfolgs-, Abandon-, Teilfehler-, Unknown- und Recovery-Sequenzen aktualisieren.
- [x] 8.3 `docs/architecture/08-cross-cutting-concepts.md` um Asset-Sichtbarkeit, Berechtigungen, Audit, Object-URL-Grenze und Cross-System-Konsistenz aktualisieren.
- [x] 8.4 `docs/architecture/09-architecture-decisions.md` um die Entscheidung für provisorische Assets und Saga statt clientseitigem Delete ergänzen.
- [x] 8.5 `docs/guides/plugin-development.md` um den verbindlichen lokalen Draft-/Save-Vertrag ergänzen; Plugin-eigene Upload-Lebenszyklen ausdrücklich ausschließen.
- [x] 8.6 `pnpm check:file-placement`, `pnpm check:server-runtime`, relevante Nx-Unit-/Type-/ESLint-Targets und DB-/E2E-Integrationspfade grün ausführen.
- [x] 8.7 Vor einem initialen Code-Push den affected Scope messen; bei handhabbarem Scope die affected Gates, andernfalls den gemäß `DEVELOPMENT_RULES.md` passenden vollständigen PR-Gate-Pfad ausführen.
