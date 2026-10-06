## ADDED Requirements

### Requirement: Plugin-Metadaten sind ohne Browser-Entry-Point materialisierbar

Das System MUST deklarative Plugin-Beiträge aus einem serverfähigen,
manifestgebundenen Descriptor validieren. Server-Bootstrap, HTTP-Dispatch und
Worker MUST ihre Plugin-Metadaten aus der so validierten Katalogentscheidung
beziehen, ohne Browser-Entry-Points, React-Fachseiten oder Browser-Logger
auszuwerten. Browser-Views MUST an die validierten Routenmetadaten gebunden
werden; sie dürfen keinen unabhängigen Metadatenbestand veröffentlichen.

#### Scenario: Browser-Entry-Point ist auf dem Server nicht auswertbar

- **GIVEN** ein aktiviertes Plugin hat einen gültigen Descriptor sowie Server- und Job-Entry-Points
- **AND** sein Browser-Entry-Point wirft beim Node-Import
- **WHEN** Bootstrap, HTTP-Dispatch und Worker ihre Beiträge registrieren
- **THEN** werden die validierten Server- und Job-Beiträge registriert
- **AND** der Browser-Entry-Point wird dabei nicht ausgewertet

#### Scenario: Deaktiviertes oder inkompatibles Plugin

- **GIVEN** ein Plugin ist deaktiviert oder sein Manifest ist mit dem Host inkompatibel
- **WHEN** der Katalog in Browser und Server materialisiert wird
- **THEN** liefert das Plugin in keinem Kontext Routen, IAM-, Lifecycle-, Server- oder Job-Beiträge
- **AND** es werden keine Browser-Views an diesen Eintrag gebunden

#### Scenario: Browser-Binding weicht vom validierten Descriptor ab

- **GIVEN** ein Browser-Entry-Point liefert eine fehlende, fremde oder doppelte Routenbindung
- **WHEN** der Host die Browser-Views an den validierten Descriptor bindet
- **THEN** wird die inkonsistente Bindung vor Veröffentlichung des Browser-Snapshots abgewiesen

#### Scenario: Descriptor fehlt oder ist nicht ladbar

- **GIVEN** ein ausgewähltes Plugin deklariert keinen ladbaren Descriptor
- **WHEN** der Host den Katalog auflöst
- **THEN** werden keine partiellen Beiträge des Plugins registriert
- **AND** ein für den Bootstrap erforderlicher Beitrag bleibt vor Request-Annahme fail-closed
