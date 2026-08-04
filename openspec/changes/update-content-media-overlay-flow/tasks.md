## 1. Specification

- [x] 1.1 Bestehenden Overlay-, Referenz-, Plugin- und Mainserver-Vertrag als Baseline prüfen
- [x] 1.2 Delta-Specs für `media-management` und `content-management` auf Asset-/Verwendungsvertrag, Berechtigungen und Teilfehler schärfen
- [x] 1.3 `openspec validate update-content-media-overlay-flow --strict` erfolgreich ausführen

## 2. Neutraler Bildblock

- [x] 2.1 Neutrales `ContentMediaUsage`-Modell mit getrennter `uiId`, optionaler `assetId`, persistierbarer URL, transienter Preview-URL und contentbezogenen Metadaten definieren
- [x] 2.2 Kontrollierten Bildblock mit Leerzustand, Vorschau, Metadatenfeldern, Validierung, Entfernen und barrierefreiem Umsortieren in `studio-ui-react` extrahieren
- [x] 2.3 Mediathek, Upload und manuelle Bild-URL über den bestehenden `StudioMediaPickerOverlay` integrieren
- [x] 2.4 Asset-Verknüpfungs- und Referenzsynchronisationszustand sichtbar machen
- [x] 2.5 Feldweisen Differenzdialog `Metadaten aus Mediathek aktualisieren` mit konservativer Override-Behandlung implementieren
- [x] 2.6 Fokussteuerung, Live-Region, zugängliche Beschriftungen sowie Lade- und Fehlerzustände vereinheitlichen

## 3. Host-Vertrag, Berechtigungen und Persistenz

- [x] 3.1 Bestehende Media- und Referenz-Clients im `plugin-sdk` für den neutralen Rückgabevertrag wiederverwenden und nur belegte fehlende Typen ergänzen
- [x] 3.2 Einstiege und Review gemäß Content-Recht, `media.read`, `media.create`, `media.update` und `media.reference.manage` abstufen
- [x] 3.3 Review ohne `media.update` schreibgeschützt halten und Übernahme weiterhin erlauben
- [x] 3.4 Kurzlebige oder für den Mainserver ungeeignete Auslieferungs-URLs fail-closed von der Persistenz ausschließen
- [x] 3.5 Mainserver-Content zuerst speichern und anschließend Referenzen für die stabile Ziel-ID idempotent ersetzen
- [x] 3.6 Referenzteilfehler unterscheidbar anzeigen und eine Wiederholung ohne erneutes Mainserver-Schreiben ermöglichen
- [x] 3.7 Abweichende oder nicht auflösbare Referenzen beim Laden sichtbar machen, ohne sie stillschweigend zu verändern

## 4. Plugin-Integration

- [x] 4.1 POI als Referenzmigration auf gemeinsamen Bildblock, Mainserver-Snapshot und geordnete Studio-Referenzen umstellen
- [x] 4.2 News über einen typsicheren Adapter migrieren und `contentType`, `width` sowie `height` erhalten
- [x] 4.3 Events über einen typsicheren Adapter migrieren und `contentType`, `width` sowie `height` erhalten
- [x] 4.4 Generic Items über einen typsicheren Adapter migrieren und verschachtelte Blockmedien außerhalb des vereinbarten Kernblocks unverändert erhalten
- [x] 4.5 Projects einschließlich `altText`, `caption`, `credits` und lückenloser Positionsableitung migrieren
- [x] 4.6 Cockpit Cards einschließlich `sourceUrl.description`, festem `contentType`, Reihenfolge und Pflichtbildvalidierung migrieren
- [x] 4.7 Die bestehende Medienrolle `gallery_item` sowie `targetType`, `targetId` und `sortOrder` in allen sechs Referenzadaptern durch Tests fixieren
- [x] 4.8 Plugin-eigene Upload-, Picker-, Bildlisten- und Preview-Duplikate erst nach erfolgreicher jeweiliger Migration entfernen
- [x] 4.9 Bestehende Inhalte und unbekannte fachliche Felder ohne Datenmigration und ohne Roundtrip-Verlust laden, bearbeiten und speichern

## 5. Tests und Gates

- [x] 5.1 `studio-ui-react`-Komponententests für alle drei Einstiege, Vorschau, Metadaten, Differenzdialog, Umsortieren, Entfernen, Fokus, Live-Region und Fehlerzustände ergänzen
- [x] 5.2 Overlay-Tests für schreibbaren und schreibgeschützten Review, Upload, Abbruch und explizite Übernahme ergänzen oder anpassen
- [x] 5.3 Adapter- und Roundtrip-Tests für alle sechs Editor-Flows einschließlich unbekannter Zusatzfelder ergänzen
- [x] 5.4 Permission-Tests für Content-Recht und alle benötigten `media.*`-Actions ergänzen
- [x] 5.5 Integrations- oder E2E-Tests für Mainserver-/Referenzerfolg, Referenzteilfehler und idempotente Wiederholung ergänzen
- [x] 5.6 Negative Tests für geschützte Assets, fehlende persistierbare URL und presigned URLs ergänzen
- [x] 5.7 Nach jedem Plugin-Block dessen Nx-Unit- und Type-Targets ausführen; bei Runtime-Änderungen an serverseitigen Packages früh `pnpm check:server-runtime` ausführen
- [ ] 5.8 Vor finaler Freigabe den affected Scope messen und `pnpm test:pr` oder den dokumentierten kleinsten vollständigen Gate-Pfad grün ausführen

## 6. Dokumentation

- [x] 6.1 `docs/architecture/05-building-block-view.md` um gemeinsamen Bildblock und Paketgrenzen aktualisieren
- [x] 6.2 `docs/architecture/06-runtime-view.md` um Snapshot-/Referenz-Speicherreihenfolge, Abbruch und Teilfehler aktualisieren
- [x] 6.3 `docs/architecture/08-cross-cutting-concepts.md` um Metadaten-Ownership, Berechtigungen und Cross-System-Konsistenz aktualisieren
- [x] 6.4 `docs/guides/plugin-development.md` um Adapter-, Rollen-, URL-Bridge- und Roundtrip-Vertrag aktualisieren
- [x] 6.5 Kein DB-Schemaeingriff erforderlich; Schema-Snapshot und Schema-Dokumentation bleiben unverändert
