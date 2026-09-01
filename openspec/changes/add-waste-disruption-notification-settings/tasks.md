## 1. Verträge und tenantbezogene Persistenz

- [x] 1.1 Core-Verträge für beide Störungsoptionen und getrennte reguläre/Störungs-`wasteTypes`-Einträge ergänzen.
- [x] 1.2 `waste_settings` additiv um zwei `BOOLEAN NOT NULL DEFAULT FALSE`-Spalten erweitern und Repository-Read/-Write einschließlich Legacy-Defaults implementieren.
- [x] 1.3 Einstellungen-API, serverseitige Validierung, Read-after-write-Verifikation und Plugin-SDK-Vertrag um beide expliziten Booleans erweitern.
- [x] 1.4 Zentralen DB-Schema-Snapshot und die Waste-Schemadokumentation fortschreiben.

## 2. Builder und Mainserver-Synchronisation

- [x] 2.1 `buildWasteTypesStaticContent` um eine explizite Störungskonfiguration erweitern, reservierte kleingeschriebene Schlüssel getrennt erzeugen und gemeinsame deterministische Sortierung beibehalten.
- [x] 2.2 `fractionCount` ausschließlich aus aktiven regulären Fraktionen bilden und Kollisionen ohne Überschreiben ablehnen.
- [x] 2.3 Sync-Operation um das Laden der tenantbezogenen Störungskonfiguration und das vollständige kombinierte Mainserver-Payload erweitern.
- [x] 2.4 Nach erfolgreich verifiziertem Settings-Save denselben asynchronen `waste-management.sync-waste-types`-Job wie bei Fraktionsmutationen einreihen; lokales Save-Ergebnis bei Sync-Fehler erhalten.

## 3. UI, i18n und Fehlerfeedback

- [x] 3.1 Zwei unabhängige vorhandene Switch-Primitives mit sichtbaren Labels und Hilfetexten in einer eigenen Waste-Einstellungssektion ergänzen.
- [x] 3.2 Form-Mapping und Request-Payload bei fehlenden Bestandsfeldern sicher auf `false` normalisieren.
- [x] 3.3 Deutschen und englischen Übersetzungsvertrag ergänzen.
- [x] 3.4 Angenommenen Sync-Job verfolgen und enqueue-/terminalen Fehler mit bestehendem Warnungs- und Retry-Muster anzeigen.

## 4. Tests, Dokumentation und Verifikation

- [x] 4.1 Builder-Tests für alle vier Optionskombinationen, exakte Schlüssel/Labels, `notification_kind`, Fraktionsregression, Kollision, `fractionCount` und deterministischen Hash ergänzen.
- [x] 4.2 Repository-, Schema-, API- und Persistenztests für beide Booleans, unabhängige Speicherung sowie sichere Legacy-Defaults ergänzen.
- [x] 4.3 UI-Tests für Laden, unabhängiges Aktivieren/Deaktivieren, Speichern, zugängliche Labels, Jobtracking, Warnung und Retry ergänzen.
- [x] 4.4 Sync-Integrationstest für kombiniertes vollständiges Mainserver-Payload sowie Entfernung deaktivierter Sondertypen ergänzen.
- [x] 4.5 Arc42-Runtime und Qualitätsanforderungen aktualisieren; keine zweite normative Rolloutanleitung einführen.
- [x] 4.6 Nach jedem Änderungsblock den kleinsten relevanten Nx-Unit-/Type-Pfad ausführen; für serverseitige Packages `pnpm check:server-runtime`, Schemaänderungen und File-Placement gezielt prüfen.
- [x] 4.7 Affected-Scope gemessen: 31 Unit-Projekte und damit lokal ein breiter PR-Gate-Lauf. Da kein Push oder PR beauftragt ist, wurde `pnpm test:pr` nicht zusätzlich zu den gezielten Gates ausgeführt; die strikte OpenSpec-Validierung ist grün.
- [ ] 4.8 Staging-Evidenz für alle vier Kombinationen und MeinePR-Aktivierung sammeln; Production-Promotion bleibt dem kanonischen Rolloutprozess vorbehalten.
