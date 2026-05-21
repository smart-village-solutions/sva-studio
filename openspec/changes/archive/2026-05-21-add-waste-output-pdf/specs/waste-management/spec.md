## ADDED Requirements
### Requirement: Waste-Management bietet einen Ausgabe-Tab für Dokumentausgaben

Das System SHALL innerhalb des Waste-Management-Plugins einen zusätzlichen Tab `Ausgabe` bereitstellen.

#### Scenario: Benutzer wechselt in den Ausgabe-Bereich

- **WHEN** ein berechtigter Benutzer im Waste-Management den Tab `Ausgabe` auswählt
- **THEN** rendert das Plugin ein eigenes Tabpanel für Dokument- und Ausgabe-Funktionen
- **AND** das Tabpanel ist als vertikale Folge von Cards organisiert
- **AND** die erste Card ist für den `PDF-Ausdruck` vorgesehen

### Requirement: Der erste PDF-Ausdruck wird für genau einen Abholort und genau ein Jahr konfiguriert

Das System SHALL den ersten produktiven PDF-Ausdruck als jahresbezogenen Abfallkalender für genau einen Abholort modellieren.

#### Scenario: Benutzer konfiguriert den PDF-Ausdruck

- **WHEN** ein berechtigter Benutzer die Card `PDF-Ausdruck` im Tab `Ausgabe` nutzt
- **THEN** kann er genau einen Abholort auswählen
- **AND** kann genau ein Jahr für die Ausgabe festlegen
- **AND** der Konfigurationsumfang enthält im ersten Ausbau keine Mehrjahresausgabe und keine Sammelausgabe für Orte oder Regionen

#### Scenario: PDF-Ausdruck enthält automatisch alle wirksamen Fraktionen und Termine

- **WHEN** für einen Abholort und ein Jahr ein PDF-Ausdruck erzeugt wird
- **THEN** werden alle für diesen Abholort wirksamen Fraktionen automatisch berücksichtigt
- **AND** reguläre Termine und fachlich wirksame Ausweichtermine des gewählten Jahres werden automatisch berücksichtigt
- **AND** der erste Ausbau bietet keine manuelle Auswahl einzelner Fraktionen im Konfigurationsformular

### Requirement: Der Ausgabe-Tab dient nur der Konfiguration, nicht der Vorschau

Das System SHALL im ersten Ausbau keine PDF-Vorschau innerhalb des Tabs `Ausgabe` rendern.

#### Scenario: Benutzer öffnet den Ausgabe-Tab

- **WHEN** ein berechtigter Benutzer die Konfiguration für den `PDF-Ausdruck` aufruft
- **THEN** zeigt der Tab nur die Konfigurations- und Erzeugungsoberfläche
- **AND** rendert keine eingebettete PDF-Vorschau
- **AND** verlagert die operative Nutzung erzeugter PDFs auf andere UI-Stellen

### Requirement: Waste-Management integriert den vorhandenen Beispielgenerator als produktive Grundlage

Das System SHALL den vorhandenen Waste-Calendar-Beispielgenerator als Grundlage für den produktiven PDF-Ausdruck wiederverwenden, ohne den Script-Pfad selbst als Produktivvertrag zu belassen.

#### Scenario: Produktive PDF-Erzeugung nutzt keinen Ops-Script-Pfad direkt

- **WHEN** das System einen produktiven PDF-Ausdruck für den Abfallkalender erzeugt
- **THEN** stammt das Render-Grundgerüst fachlich aus dem vorhandenen Beispielgenerator
- **AND** Dokumentmodell, Datenaufbereitung und Rendering sind in einen produktiven Package-Pfad des Studios überführt
- **AND** `scripts/ops/waste-calendar-example-pdf*.ts` bleibt Referenz oder Quellmaterial, aber nicht der produktive Laufzeitvertrag

### Requirement: Erzeugte PDF-Links sind in der Tabelle Abholorte sichtbar

Das System SHALL erzeugte PDF-Links zusätzlich in der Tabelle `Abholorte` zugänglich machen.

#### Scenario: Benutzer arbeitet in der Abholorte-Tabelle

- **WHEN** für einen Abholort bereits PDF-Ausgaben erzeugt wurden
- **THEN** zeigt die Tabelle `Abholorte` den zugehörigen PDF-Link oder die zugehörigen PDF-Links in der Tabellenansicht an
- **AND** der Benutzer muss den Tab `Ausgabe` nicht erneut öffnen, um einen vorhandenen Ausdruck aufzurufen

### Requirement: Die PDF-Erzeugung erfolgt serverseitig im Instanzkontext

Das System SHALL die Erzeugung des Abfallkalender-PDFs serverseitig im aktiven Instanzkontext ausführen.

#### Scenario: Benutzer startet die PDF-Erzeugung

- **WHEN** ein berechtigter Benutzer im Tab `Ausgabe` einen PDF-Ausdruck für einen Abholort und ein Jahr startet
- **THEN** verarbeitet die Host-Fassade die Anforderung serverseitig
- **AND** lädt die hierfür notwendigen Waste-Daten im Kontext der aktiven Instanz
- **AND** der Browser erhält keinen direkten Zugriff auf Render- oder Datenbankgeheimnisse
