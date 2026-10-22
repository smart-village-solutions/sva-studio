## 1. Entwurfsprüfung vor Implementierungsplanung

- [x] 1.1 Bestehende Medienverträge und angrenzende Changes prüfen und den im Dialog freigegebenen Entwurf dokumentieren.
- [x] 1.1a Gedanklichen Durchlauf aus Sicht ungeschulter Redakteure auf Nutzerfreigabe in Entwurf und Abnahmeszenarien einarbeiten; kein durchgeführter Nutzertest.
- [x] 1.1b Textliches Designkonzept für bestehende Mediathek, Mediendetail und gemeinsamen Bildeditor einschließlich Speicherzuständen und barrierefreier Bedienung ausarbeiten.
- [x] 1.1c Konzeptabgleich K1–K7 einarbeiten: bestehende Spec korrigieren, alle Verbrauchergrenzen erhalten, Datenschutz-/Accessibility-Abnahme konkretisieren und die spezialisierte Editor-Ausnahme begrenzen; redaktionelle Hinweise bleiben ohne zusätzliche Freigaben nicht blockierend.
- [x] 1.1d Technische Vorprüfung mit isoliertem React-19-Browserlauf, repräsentativem Zustands-Roundtrip, Typ-/Netzwerkprüfung und bestehendem Persistenzpfad dokumentieren; ursprünglichen Accessibility-Befund erhalten.
- [x] 1.1e Ausdrückliche Nutzerakzeptanz der begrenzten Accessibility-Abweichung in ADR-069 festhalten, Filerobot als Integrationsweg wählen und Konzept/Spec/Eignungsbewertung konsistent fortschreiben; keine umfassende eigene Nachrüstung verlangen.
- [x] 1.2 Schriftlichen Entwurf durch den Nutzer prüfen lassen; vollständige Umsetzung bis zum PR ausdrücklich freigegeben.
- [x] 1.3 Nach dieser Prüfung den konkreten Implementierungsplan im bestehenden Pfad ausarbeiten; Library-Nachweise, minimale Persistenzentscheidung, kritische Invarianten und gezielte Gates einbeziehen.
- [x] 1.4 Implementierungsfreigabe erhalten; Dokumentations- und Schemafortschreibung bleibt Teil der Lieferaufgaben.

## 2. Gemeinsame Verträge und Metadaten

- [x] 2.1 Gemeinsame Metadaten-Grenzen und Entwurfs-/Patch-Semantik mit Unit-Tests absichern.
- [x] 2.2 Vollständige Metadatenpflege in Mediendetail und Picker; zentrale Speicherung ausdrücklich trennen, lokale Entwürfe erhalten und Tags ergänzen.

## 3. Sichere weiterbearbeitbare Kopien

- [x] 3.1 Begrenzten Editorzustand und Quellbezug im bestehenden Asset-Modell ergänzen; Migration und beide Schemadokumente fortschreiben.
- [x] 3.2 Upload/Verarbeitung um private lokale Grundlage beziehungsweise autorisierten Quellbezug erweitern; Scan, Quote und idempotente Finalisierung aller zugehörigen Daten absichern.
- [x] 3.3 Berechtigten Editor-Lesepfad und öffentliche Projektionen trennen; Quellen-/Kopienabhängigkeiten anzeigen und Löschrennen vor Storage-I/O absichern.
- [x] 3.4 SDK und lokale Content-Entwürfe um Metadaten und Bearbeitungsdaten erweitern; bestehende Content-Save-/Recovery-Pfade beibehalten.

## 4. Vollständiger gemeinsamer Editor

- [x] 4.1 Geprüfte Filerobot-Versionen einbinden, browserseitig verzögert laden, Zustand/Export validieren, lokale Ressourcen und Studio-Übersetzungen verwenden.
- [x] 4.2 Gemeinsamen Ablauf für Bearbeiten, Metadaten und Variantenvorschau einschließlich wichtigem Bildbereich und Abbruch implementieren.
- [x] 4.3 Mediathek und sechs Content-Anbindungen integrieren; Waste mit eigenem unmittelbarem Abschluss erhalten; manuelle URLs und geschützte Quellen korrekt behandeln.
- [x] 4.4 Default/Forest in Light/Dark sowie Studio-Rahmen-A11y absichern; akzeptierte Spezialeditor-Abweichung sichtbar dokumentieren.

## 5. Abschlussnachweise und PR

- [x] 5.1 Gezielte Unit-/Typ-/Integrations-/Browsernachweise je Lieferabschnitt; Server-Runtime, Migration/Datenintegrität, Security, i18n und Platzierung prüfen.
- [x] 5.2 Aktuelle Medien-/Anwenderdokumentation, Accessibility Statement und arc42 05/06/08 fortschreiben.
- [x] 5.3 Lokale Coverage-/Komplexitätsgates und referenzierte Anforderungen am endgültigen Stand auditieren; fremde Änderungen ausschließen.
- [ ] 5.4 Kohärenten Branch pushen und PR nach main erstellen; GitHub-Gates für den exakten finalen HEAD bis zum terminalen Ergebnis auswerten. Kein Merge/Rollout.

## Kritische Invarianten und Nachweise

- Original und vorhandene Verwendungen bleiben bei jeder Bildbearbeitung unverändert: Mapping-/Browsertests und Quell-/Kopien-Readback.
- Kein neuer Serverzustand vor Content-Speichern; kein Löschen bei unklarem Content-Erfolg: bestehende Operations-/Abbruch-/Recovery-Tests erweitern.
- Grundlage, Zustand und Ausgabe werden nur zusammen freigegeben; Scan-/Quote-/Claim-Fehler bleiben ohne Freigabe: Handler-/Repository-/Postgres-Integrationstests.
- Zugriff und Sichtbarkeit auf tatsächliche Grundlage, Kopie und öffentliche Projektionen bleiben getrennt: negative Rechte-/Instanz-/CSRF-Tests.
- Kopienanlage und Quellenlöschung sind vor Storage-Löschung serialisiert; Wiederholung löscht oder bucht nicht doppelt: Konkurrenz- und Cleanup-Tests.
- Keine zusätzlichen externen Editorabrufe; Zustand wiederherstellbar: Browser-Netzwerkprüfung und Export-/Reload-Fixtures.
- Normale Studio-Oberflächen bleiben zugänglich; Spezialeditor-Abweichung bleibt auf ADR-069 begrenzt: Komponenten-/Browsernachweise.
