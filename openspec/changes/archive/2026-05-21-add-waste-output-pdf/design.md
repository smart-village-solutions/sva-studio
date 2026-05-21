## Context
Im alten Waste-Plugin-Branch existiert mit `scripts/ops/waste-calendar-example-pdf.ts` bereits ein generatornaher Beispielbaustein für einen zweitseitigen Abfallkalender als PDF. Dieser Baustein rendert jedoch nur Platzhalterdaten für `Musterstadt`, lebt außerhalb der produktiven Plugin-Architektur und ist weder an Instanzkontext noch an reale Abholorte, Touren, Fraktionen oder Ausweichtermine angebunden.

Das Ziel ist ein erster produktiver Ausgabe-Pfad innerhalb des Waste-Management-Plugins. Der Umfang bleibt bewusst klein:
- genau ein Abholort pro PDF
- genau ein Jahr pro PDF
- immer alle für den Abholort wirksamen Fraktionen und Termine
- keine Vorschau im `Ausgabe`-Tab
- Links auf erzeugte PDFs zusätzlich in der Tabelle `Abholorte`

## Goals / Non-Goals
- Goals:
  - Bestehenden Beispielgenerator als Grundlage wiederverwenden
  - Konfiguration und Erzeugung serverseitig in die Waste-Management-Capability integrieren
  - UI-seitig einen klaren `Ausgabe`-Tab mit vertikalen Cards schaffen
  - Operative Nutzung über PDF-Links in `Abholorte` unterstützen
- Non-Goals:
  - Mehrjahresausgaben
  - Sammelausgaben für Ort, Region oder Straße
  - Selektives Ein- und Ausschalten einzelner Fraktionen
  - In-UI-PDF-Vorschau
  - Öffentliche Bürger-API oder Download-Feed

## Decisions
- Decision: Hybrid-Ansatz statt kompletter Neuentwicklung.
  - Der alte Beispielgenerator wird nicht direkt produktiv verwendet, aber sein Dokumentmodell und Render-Grundgerüst werden in einen produktiven Package-Pfad überführt.
  - Alternatives considered:
    - Direktes Weiterverwenden des Scripts wäre schneller, koppelt aber Produktivlogik an einen Ops-/Beispielpfad.
    - Vollständige Neuentwicklung vermeidet Altlasten, verwirft aber bereits passende Layout- und Renderlogik.

- Decision: Die Konfiguration lebt im neuen Tab `Ausgabe`, die Nutzbarkeit der erzeugten Artefakte zusätzlich in `Abholorte`.
  - Damit bleibt die Erzeugung konzeptionell getrennt von der Tabellenarbeit, ohne die Auffindbarkeit der PDFs zu verlieren.

- Decision: Der erste Ausbau bleibt synchron auf `collectionLocationId + year` fokussiert.
  - Das reduziert fachliche und technische Komplexität, vor allem bei Terminauflösung, Fehlerfällen und Linkanzeige.

- Decision: Alle wirksamen Fraktionen und Termine werden automatisch aus den Waste-Daten abgeleitet.
  - Dadurch bleibt das Konfigurationsformular klein und vermeidet im ersten Schritt zusätzliche Filter- oder Override-Logik.

## Architecture Sketch
1. Produktiver Generator
- Neues produktives Modul für:
  - Dokumentmodell des Abfallkalenders
  - Aufbereitung von Kalenderdaten aus Waste-Daten
  - PDF-Rendering
- Der bisherige Script-Baustein dient nur als fachlich-visuelle Basis.

2. Serverseitige Ausgabe
- Neuer Waste-Management-Serverpfad für PDF-Erzeugung mit:
  - `collectionLocationId`
  - `year`
- Der Host löst die aktive Instanz auf, lädt die notwendigen Fachdaten und rendert daraus das PDF serverseitig.

3. Plugin-UI
- Neuer Tab `Ausgabe`
- Mehrere Cards untereinander
- Erste Card `PDF-Ausdruck` mit:
  - Auswahl `Abholort`
  - Auswahl/Eingabe `Jahr`
  - Aktion zum Erzeugen des PDFs
- Keine Vorschau in diesem Tab

4. Tabellenintegration
- Die Tabelle `Abholorte` zeigt vorhandene PDF-Links für den jeweiligen Abholort zusätzlich an.
- Der Tabellenvertrag muss dabei nicht den gesamten Konfigurationsfluss wiederholen, sondern nur die erzeugten Artefakte zugänglich machen.

## Risks / Trade-offs
- Der Beispielgenerator ist noch auf statische Platzhalter zugeschnitten.
  - Mitigation: klare Extraktion in Dokumentmodell, Datenaufbereitung und Rendering.
- Terminauflösung für einen Abholort kann fachlich komplex werden, wenn Tourzuordnungen, Ausweichtermine und Jahresbezug zusammenkommen.
  - Mitigation: Scope bleibt zunächst auf genau ein Jahr und vollständige automatische Ableitung begrenzt.
- PDF-Linkanzeige in `Abholorte` braucht eine belastbare Artefaktstrategie.
  - Mitigation: Im Change muss explizit festgelegt werden, ob Links direkt generiert, als Job-Ergebnis referenziert oder separat persistiert werden.

## Migration Plan
1. Beispielgenerator analysieren und in produktive Bausteine zerlegen
2. Datenmodell für adressgenaue Kalenderdaten definieren
3. Serverpfad und Rechtevertrag ergänzen
4. `Ausgabe`-Tab mit Konfigurations-Card einführen
5. PDF-Linkanzeige in `Abholorte` ergänzen
6. Tests und Doku nachziehen

## Open Questions
- Wie genau PDF-Artefakte technisch abgelegt oder referenziert werden, bleibt im Implementierungsplan zu konkretisieren.
- Ob spätere erneute Erzeugungen pro Abholort/Jahr Versionen überschreiben oder historisieren, bleibt außerhalb des ersten Ausbaus.
