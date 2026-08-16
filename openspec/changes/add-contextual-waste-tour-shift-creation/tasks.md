## 1. Fachlogik und Datenvertrag

- [x] 1.1 Framework-agnostische Core-Auswahl für jahresunabhängige Grundregel und vorrangige jahresbezogene Ausnahme implementieren
- [x] 1.2 Kanonisches Waste-Tenant-Schema auf PostgreSQL `DATE` und die beiden partiellen Unique-Indizes umstellen
- [x] 1.3 Nächste freie versionierte Waste-Tenant-Migration mit fail-closed Bestands-Preflight, `DATE`-Postconditions und ohne automatische Legacy-Transformation ergänzen
- [x] 1.4 Repository-SELECTs per `to_char(..., 'YYYY-MM-DD')` und Schreibparameter als `::date` ausführen, ohne JavaScript-`Date` an der Fachgrenze
- [x] 1.5 Unique-Verletzungen derselben Spezifität serverseitig in einen stabilen fachlichen `409 Conflict` übersetzen
- [x] 1.6 Studio-Kalender, Mainserver-Materialisierung und Public-Waste-Projektion auf die gemeinsame Auswahlregel umstellen

## 2. Route und Vorbelegung

- [x] 2.1 Normalisierte Search-Parameter `schedulingTourId` und `schedulingOriginalDate` mit gemeinsamem Gültigkeitsvertrag ergänzen
- [x] 2.2 Gemeinsamen Href-Builder für die tourbezogene Erstellungsansicht implementieren
- [x] 2.3 Scheduling-Erstellungsansicht genau einmal aus gültigem Route-Kontext vorbelegen und spätere Benutzereingaben nicht überschreiben
- [x] 2.4 Ungültigen oder widersprüchlichen Kontext sichtbar und sicher verwerfen sowie Kontext bei Abbruch und Erfolg bereinigen
- [x] 2.5 Im kontextuellen Flow den Typ-Select durch einen kompakten Kontextblock ersetzen; die allgemeine Erstellung unverändert lassen

## 3. Kontextuelle Einstiege

- [x] 3.1 Erstellungsaktionen für leere und gefüllte Verschiebungszellen einschließlich eindeutig bezeichnetem Detaildialog ergänzen
- [x] 3.2 Reguläre, noch nicht verschobene Termine im Jahreskalender mit kurzem sichtbarem Text und vollständigem zugänglichem Namen anbieten
- [x] 3.3 Aktion im Bearbeitungsformular gespeicherter turnusbasierter Touren ergänzen und bei individuellen sowie bedarfsabhängigen Touren ausblenden
- [x] 3.4 Aktion bei ungespeicherten Änderungen an Turnus, Abstandspreset, Start- oder Enddatum deaktivieren und den erforderlichen Speicherschritt erklären
- [x] 3.5 Sichtbarkeit aller neuen Aktionen an die aufgelöste UI-Capability `waste-management.scheduling.manage` binden
- [x] 3.6 Deutsche und englische Übersetzungen für Aktionen, Kontext, Override-, Dirty-, Konflikt- und Invalid-Hinweise ergänzen

## 4. Tests

- [x] 4.1 Search-Normalisierung, Href-Erzeugung, Kontextbereinigung und einmalige Hydrierung mit fokussierten Unit-Tests absichern
- [x] 4.2 Leere und gefüllte Tabellenzelle, Detaildialog, Kalender, Tourformular, UI-Access, sicheren New-Tab-Link und zugängliche Namen mit Komponententests absichern
- [x] 4.3 Regelpriorität, gleiche Spezifität und unveränderte globale beziehungsweise Feiertagspriorität in Core und allen drei Konsumenten charakterisieren
- [x] 4.4 PostgreSQL-Integrationstests für `DATE`, partielle Unique-Indizes, konkurrierende Inserts, Update des eigenen Datensatzes und `409 Conflict` ergänzen
- [x] 4.5 Date-only-Parität unter mindestens zwei Prozesszeitzonen einschließlich `Europe/Berlin` nachweisen
- [x] 4.6 Gezielten Browserflow für neuen Tab, vorausgefüllte Tour und vorausgefülltes Originaldatum absichern

## 5. Dokumentation und Verifikation

- [x] 5.1 Relevante Waste-Bedienungsdokumentation aktualisieren
- [x] 5.2 Zentralen Studio-Snapshot geprüft und unverändert gelassen; `docs/development/studio-db-schema.md` sowie das davon getrennte kanonische externe Waste-Runtime-Schema fortgeschrieben
- [x] 5.3 `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md` und `docs/architecture/08-cross-cutting-concepts.md` um gemeinsame Regel-Ownership, Laufzeitfluss und Date-only-Vertrag ergänzen
- [ ] 5.4 Vor Migration und Rollout den bestätigten leeren Produktivbestand der betroffenen Ausweichtermin-Daten erneut fail-closed verifizieren
- [x] 5.5 Betroffene Nx-Unit- und Type-Gates sowie bei Core-, Repository- und Auth-Runtime-Änderungen früh `pnpm check:server-runtime` ausführen
- [x] 5.6 `pnpm check:file-placement` und `pnpm exec openspec validate add-contextual-waste-tour-shift-creation --strict` ausführen
