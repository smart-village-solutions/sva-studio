## ADDED Requirements

### Requirement: Registrierte Content-Typen werden aus der kanonischen Build-time-Registry materialisiert

Das System SHALL plugin-spezifische Content-Typen ausschließlich aus derselben kanonischen Build-time-Pluginliste ableiten, aus der auch Registry, Routen, Navigation und Übersetzungen entstehen.

#### Scenario: Host leitet Content-Type-Definitionen aus der Pluginliste ab

- **WHEN** der Host registrierte Content-Typen für das Inhaltsmanagement bereitstellt
- **THEN** stammen diese Definitionen aus der kanonischen Build-time-Pluginliste
- **AND** es gibt keinen separaten app-lokalen Pfad nur für Content-Type-Registrierung

#### Scenario: Plugin-spezifische Content-Views hängen am selben Registry-Vertrag

- **WHEN** ein Plugin einen spezialisierten Content-Typ wie `news` bereitstellt
- **THEN** werden dessen Content-Type-Metadaten, Routen, Navigation und Übersetzungen aus demselben Build-time-Vertrag materialisiert
- **AND** der Host benötigt keine fachliche Sonderverdrahtung außerhalb dieser Registry

### Requirement: Der Content-Kern bleibt Host-geführt trotz Build-time-Erweiterung

Das System SHALL trotz Build-time-Registrierung plugin-spezifischer Content-Typen den Content-Kern hostgeführt und deterministisch materialisiert halten.

#### Scenario: Plugin erweitert, ersetzt aber nicht den Host-Kern

- **WHEN** ein Plugin einen Content-Typ registriert
- **THEN** ergänzt es den hostgeführten Content-Kern nur über deklarative Beiträge
- **AND** Core-Semantik, Statusmodell und systemweite Materialisierung bleiben durch den Host kontrolliert
