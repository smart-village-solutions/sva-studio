## ADDED Requirements

### Requirement: Gemeinsame semantische Datums- und Zeitbausteine

Studio und seine Fachplugins MUST für Datums- und Zeiteingaben sowie deren Darstellung die bestehenden gemeinsamen Pakete verwenden und Kalendertage, Uhrzeiten, lokale Datum/Uhrzeit-Werte und absolute Zeitpunkte unterscheiden. Fachkalender für Jahres- und Mehrfachauswahl bleiben zulässig.

#### Scenario: Lokalisierte Eingabe eines Kalendertags

- **WHEN** ein Redakteur einen Kalendertag eingibt
- **THEN** folgt die Eingabe der aktiven Locale und die API erhält den Kalendertag im vereinbarten technischen Format ohne Zeitzonenverschiebung

#### Scenario: Absoluter Zeitpunkt mit Sommerzeit

- **WHEN** ein absoluter Zeitpunkt bearbeitet wird
- **THEN** verwenden Anzeige und Rückkonvertierung die bestehende Redaktionszeitzone und erhalten unveränderte Referenzwerte einschließlich ihrer Präzision
- **AND** werden nicht existente lokale Zeiten abgewiesen

#### Scenario: API-spezifischer Datumsvertrag

- **WHEN** ein API-Feld eine bestimmte Genauigkeit, Leerwertsemantik oder inklusive/exklusive Grenze verlangt
- **THEN** setzt der zuständige Adapter diesen Vertrag um und ein Payloadtest sichert ihn ab
- **AND** werden keine lokalisierten Anzeigetexte übertragen
