## ADDED Requirements

### Requirement: PDF-Legende zeigt kontextbezogene Hinweise vertikal

Das System SHALL die Legende des PDF-Abfallkalenders direkt unterhalb des Kalenderrasters als vertikale Liste mit höchstens acht einzeiligen Einträgen darstellen.

#### Scenario: Sichtbare Fraktion besitzt eine Beschreibung

- **WHEN** eine im PDF sichtbare Fraktion eine Beschreibung besitzt
- **THEN** zeigt ihre Legendenzeile Farbbox, Kürzel und den Text `<Bezeichnung> - <Beschreibung>` ohne feste Beschreibungsspalte
- **AND** die Beschreibung verwendet den verbleibenden Platz bis zum rechten Seitenrand

#### Scenario: Sichtbare Tour oder einzelner Termin besitzt einen Hinweis

- **WHEN** eine Tour mindestens einen sichtbaren PDF-Termin erzeugt oder ein sichtbarer Termin einen eigenen Hinweis besitzt
- **THEN** zeigt die Legende den jeweiligen Tour- beziehungsweise Terminbezug und den Hinweis getrennt durch ` - ` ohne feste Beschreibungsspalte
- **AND** Hinweise nicht sichtbarer Touren oder Termine werden ausgelassen

#### Scenario: Legendentext überschreitet die verfügbare Breite

- **WHEN** ein Legendentext nicht vollständig in seine einzelne Zeile passt
- **THEN** kürzt das System ihn anhand seiner gerenderten Breite
- **AND** der sichtbare Text endet mit `...`
- **AND** es entsteht kein Zeilenumbruch

### Requirement: PDF reserviert Raum für höchstens acht Legendenzeilen

Das System SHALL durch einen kompakteren Kopfbereich und den Wegfall der redundanten Fußzeile Raum für acht Legendenzeilen schaffen, ohne das Kalenderraster zu verkleinern.

#### Scenario: PDF enthält die maximale Legendenmenge

- **WHEN** acht Legendenzeilen dargestellt werden
- **THEN** überlappt keine Legendenzeile das Kalenderraster oder den Seitenrand
- **AND** der Kopfbereich zeigt weiterhin Titel, Abholort und Branding lesbar
- **AND** die redundante Fußzeile `Abfallkalender <Jahr> · <Abholort>` wird nicht dargestellt

#### Scenario: PDF enthält Ausweichtermine

- **WHEN** mindestens ein sichtbarer Termin als Ausweichtermin gekennzeichnet ist
- **THEN** belegt `* = Ausweichtermin` die erste Zeile innerhalb der höchstens acht Legendenzeilen
- **AND** der Asterisk wird rot und fett dargestellt
