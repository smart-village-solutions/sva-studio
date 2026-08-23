## 1. Vertragsabsicherung

- [x] 1.1 Regressionstests ergänzen, die Root-`teaser` in GenericItem-Queries, -Mutationen, Variablen und TypeScript-Verträgen ausschließen
- [x] 1.2 Mappertests für `contentBlocks[].intro` und die ausdrücklich fehlende Legacy-Fallback-Semantik ergänzen

## 2. Gemeinsamer Mainserver-Vertrag

- [x] 2.1 `teaser` aus GenericItem-Eingabe-, Ausgabe- und generierten Fragmenttypen entfernen
- [x] 2.2 GenericItem-Query, Mapper, Eingabeparser und Editor-Feldmatrix auf den ContentBlock-Vertrag begrenzen
- [x] 2.3 FAQ- und Kachelvalidierung von der entfernten Top-Level-Eigenschaft entkoppeln

## 3. Content-Typen

- [x] 3.1 Separates Teaser-Feld aus dem offenen GenericItem-Editor und seinem Formularvertrag entfernen
- [x] 3.2 Featured Projects `Description` verlustfrei auf `contentBlocks[0].intro` abbilden
- [x] 3.3 Erhalt weiterer Content-Blocks und unbekannter Bestandsfelder bei Projekt-Updates absichern
- [x] 3.4 Unveränderte FAQ- und Kachel-Body-Verträge regressionsprüfen
- [x] 3.5 News-Editor, Mapper und Payload-Validierung ohne `teaser`/`body`-Fallback auf Content-Blocks umstellen

## 4. Dokumentation

- [x] 4.1 Relevante arc42-Abschnitte und Plugin-Entwicklungsdokumentation aktualisieren
- [x] 4.2 Changelog-Eintrag für den PR ergänzen

## 5. Verifikation

- [x] 5.1 Betroffene Unit-Tests nach jedem Änderungsblock ausführen
- [x] 5.2 Type-Tests und `sva-mainserver:check:runtime` ausführen
- [x] 5.3 Betroffenen Scope messen und relevante Coverage-/PR-Gates ausführen
- [x] 5.4 OpenSpec strikt validieren und Aufgabenstatus abschließend synchronisieren
