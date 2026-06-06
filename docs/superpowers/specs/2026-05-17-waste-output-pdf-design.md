# Design: Ausgabe-Tab und PDF-Erzeugung für den Abfallkalender

> Hinweis: Dieses Design ist fachlich überholt. Der aktuelle Zielvertrag liegt in [2026-06-06-public-waste-pdf-export-shift-design.md](./2026-06-06-public-waste-pdf-export-shift-design.md). Das Studio erzeugt keine PDFs mehr; die Erzeugung erfolgt ad hoc in der öffentlichen Web-App.

## Kurzbeschreibung
Das Waste-Management erhält einen neuen Tab `Ausgabe`. Die erste Card `PDF-Ausdruck` konfiguriert einen adressgenauen Jahreskalender als PDF für genau einen Abholort. Eine Vorschau ist im ersten Ausbau nicht vorgesehen. Erzeugte PDF-Links werden zusätzlich in der Tabelle `Abholorte` sichtbar gemacht.

## Fachlicher Scope
- genau ein Abholort pro Ausgabe
- genau ein Jahr pro Ausgabe
- automatisch alle wirksamen Fraktionen und Termine
- keine Mehrjahresausgabe
- keine Sammelausgabe
- keine Fraktionsfilter im ersten Schritt

## Technischer Ansatz
- Der alte Beispielgenerator aus `scripts/ops/waste-calendar-example-pdf*.ts` dient als Ausgangsbasis.
- Dokumentmodell, Datenaufbereitung und Rendering werden in einen produktiven Pfad überführt.
- Die PDF-Erzeugung läuft serverseitig im aktiven Instanzkontext.
- Der Tab `Ausgabe` dient nur der Konfiguration.
- Vorhandene PDFs werden zusätzlich in `Abholorte` verlinkt.

## UI-Zielbild
- neuer Tab `Ausgabe`
- Tabpanel mit vertikalen Cards
- erste Card `PDF-Ausdruck`
- Felder:
  - `Abholort`
  - `Jahr`
- Aktion:
  - PDF erzeugen

## Architekturwirkung
- neue produktive Ausgabe-Funktion im Waste-Management
- zusätzliche Host-Fassade für PDF-Erzeugung
- Datenaufbereitung aus Touren, Fraktionen, Abholorten und Ausweichterminen
- zusätzliche Sichtbarkeit erzeugter Artefakte in `Abholorte`

## Referenz
- OpenSpec-Change: `openspec/changes/add-waste-output-pdf/`
