# Aufgaben

Die Umsetzung wurde am 8. November 2026 freigegeben. Erledigte Arbeiten und ausstehende Abnahme-/Auslieferungsschritte sind getrennt markiert; Einzelbelege stehen im Design.

## 1. Freigabe und Bestandsabgleich

- [x] 1.1 Proposal, Design, Spezifikationen und kritische Invarianten schriftlich prüfen und freigeben lassen.
- [x] 1.2 Aktuelle Plugin-, Access-, Routing-, Persistenz- und UI-Pfade sowie Überschneidungen mit Suchplugin und Design-System-Change prüfen; vor nichttrivialen Codeänderungen verfügbare XERJ-Referenzen einschließlich Indexstand und Lizenz prüfen.
- [x] 1.3 Vor DB-Entwurf die kanonischen Schemaquellen und DB-Skills prüfen; konkrete pluginbezogene Persistenz und Migration im bestehenden Studio-DB-Pfad festlegen, ohne generisches Settings-Framework.

## 2. Plugin- und Host-Vertrag

- [x] 2.1 Plugin-Package nach bestehenden Authoring-/Distributionskonventionen erstellen und Katalog sowie Module-IAM mit `application-workspace.settings.read` und `application-workspace.settings.update` einbinden.
- [x] 2.2 Optionalen Einstellungsbeitrag im bestehenden SDK-, Descriptor- und Snapshot-Pfad ergänzen; eigene registrierte Route, Modul- und Action-Bezug validieren. Kleinste Unit-/Type-Gates unmittelbar ausführen.
- [x] 2.3 Authentifizierten instanzgebundenen Übersichtszugriff einschließlich wirksamer Aktivierung für Route und Handler umsetzen; Benutzer ohne Fachrolle explizit absichern.

## 3. Konfiguration und Übersetzungen

- [x] 3.1 Kachelkonfiguration mit stabilen Kennungen, Iconauswahl, HTTPS-Ziel, Übersetzungen und Reihenfolge client- und serverseitig validieren; feste Studio-Kachel vor Manipulation schützen.
- [x] 3.2 Instanzgebundene dauerhafte Speicherung, atomare Änderungen, Versionskonflikte und bestehende Audit-Anbindung implementieren; Migration und beide kanonischen Schemaquellen gemeinsam pflegen.
- [x] 3.3 DE-Pflichttexte, feldweisen DE-Fallback und Pflege aller zentral unterstützten Studio-Sprachen umsetzen und gezielt testen.
- [x] 3.4 Pflichtprüfungen für IAM, Datenintegrität, Migration und Server-Runtime früh ausführen; Instanzisolation, direkte API-Aufrufe, Readback, Fehlversuche und Reaktivierung mit echter Persistenz prüfen.

## 4. Oberflächen

- [x] 4.0 Tabler-Icon-Auswahl im bestehenden Figma-Designsystem „SVA Studio“ als editierbare Komponente mit Suchfläche, Auswahlvorschau, Varianten, Variablenbindungen und dokumentiertem Tastaturverhalten gestalten und abstimmen; konkrete Bibliotheksdatei/Konto vor Bearbeitung zuordnen und Node-ID sowie visuelle Prüfung festhalten.
- [x] 4.0a Dieselbe Icon-Auswahl auf vorhandenen Primitives in `@sva/studio-ui-react` implementieren; Tabler-Outline-Katalog, Standardkontur 2, stabile Kennungen, Suche, Zustände und effizientes Laden gezielt absichern. Kachelformular als ersten Verbraucher anbinden.
- [x] 4.1 3×3-Grid-Link „Anwendungen“ in die bestehende Kopfzeile integrieren; Sichtbarkeit, zugänglicher Name, Fokus und Koexistenz mit vorhandenen Aktionen einschließlich Such-Einstieg prüfen.
- [x] 4.2 Übersicht ohne Sidebar/Rail/mobile Navigation bei erhaltener Kopfzeile und unveränderten Sitzungs-/Rechtstext-Gates umsetzen; feste Studio-Kachel und externe Links mit neuem Tab und sicherem Linkverhalten anzeigen.
- [x] 4.3 Berechtigungsgebundenen Einstieg „Plugin-Einstellungen“ in der Tenant-Modulübersicht anbieten; notwendiges Seitengate ergänzen, Root-Modulzuweisung unverändert halten.
- [x] 4.4 Einstellungsseite mit Erstellen, Bearbeiten, zugänglichem Sortieren, bestätigtem Löschen, Sprachpflege und unterscheidbaren Lade-/Speicher-/Fehler-/Konfliktzuständen liefern.

## 5. Abnahme und Dokumentation

- [x] 5.1 Kritische Invarianten aus dem Design mit gezielten Unit-, Typ-, Integrations- und UI-Prüfungen nachweisen; Szenarien aus sämtlichen Spec-Deltas abdecken.
- [ ] 5.2 Desktop-/Mobilansicht, Tastatur, Screenreader-Namen, Kontrast, Sprachwechsel, gespeicherte Sidebar-Präferenzen und Kontextwechsel prüfen; Icon-Auswahl in Code und Figma einschließlich aller Zustände und Themes abgleichen.
- [x] 5.3 Plugin-Entwicklungsdokumentation, lokale redaktionelle Handbuchübergabe DE/EN und Seitenkatalog für kontextbezogene Hilfe einschließlich der SSO-Grenze aktualisieren. Die Publikation im getrennten Handbuch-Repository ist nicht Teil dieser lokalen Lieferung.
- [x] 5.4 Arc42-Abschnitte 01, 03, 05, 06 und 08 aktualisieren; 04 auf Auswirkungen prüfen. Schemaübersicht und SQL-Snapshot bei Migration konsistent halten.
- [x] 5.5 OpenSpec strikt validieren, Dateiplatzierung und betroffene Dokumentation prüfen; hinzugefügte Konzepte und Pfade auf vermeidbare Ausdehnung kontrollieren.
- [ ] 5.6 Vor Merge exakten HEAD mit erforderlichen Projektgates und Review-Evidenz abschließen. Aktivierung und Rollout separat abstimmen; reguläre Auslieferung ausschließlich nach dem kanonischen Rollout-Prozess.

Verbleibende Abnahme: vollständige manuelle Screenreader-/Produktabnahme nach 5.2 sowie die an einen späteren Merge/Auslieferungsauftrag gebundenen Schritte nach 5.6. Lokale Browser-, Tastatur-, Theme-, Sprach- und Axe-Nachweise stehen im Design.


## 6. Beauftragte Repository-Trennung

- [x] 6.1 Bestehenden externen Installationspfad und öffentliche Peer-Pakete prüfen; die neue Repository-Grenze im bestehenden Proposal/Design festhalten.
- [x] 6.2 Header-Einstieg und Content-only-Layout als eng begrenzte Beiträge im bestehenden Navigations-/Routenvertrag validieren und gezielt testen.
- [x] 6.3 Eigenständiges Plugin-Repository mit öffentlichem Paketvertrag, eigenem Build, Tests, Lockfile und Dokumentation fertigstellen.
- [x] 6.4 Studio auf die externe Paketquelle umstellen und die bisherige Workspace-Kopie sowie Quellcodeimporte vollständig entfernen.
- [x] 6.5 Externen Build/Tests, installierten Descriptor, Studio-Build/Typen, Shell, Distributionsvertrag und Dokumentation nach der Trennung prüfen.
