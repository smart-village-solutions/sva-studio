## ADDED Requirements
### Requirement: Waste-Management bietet benutzerdefinierte Abstandspresets pro Instanz
Das System SHALL im Settings-Bereich des Waste-Managements instanzbezogene Abstandspresets mit Name, optionaler Beschreibung und positiver Tagesanzahl verwalten.

#### Scenario: Benutzer legt einen benutzerdefinierten Abstand an
- **WHEN** ein berechtigter Benutzer im Settings-Bereich einen Namen und eine positive Tagesanzahl speichert
- **THEN** persistiert das System ein instanzbezogenes Abstandspreset
- **AND** das Preset steht anschließend im Tour-Formular als zusätzliche Option zur Verfügung

### Requirement: Waste-Touren können ein benutzerdefiniertes Abstandspreset referenzieren
Das System SHALL Touren zusätzlich zu den festen Default-Turnussen eine Referenz auf ein benutzerdefiniertes Abstandspreset speichern lassen.

#### Scenario: Tour verwendet benutzerdefinierten Abstand
- **WHEN** eine Tour ein Preset auswählt
- **THEN** speichert das System die Preset-Referenz statt einer freien Tageszahl an der Tour
- **AND** die Terminberechnung verwendet die Tagesanzahl des referenzierten Presets
- **AND** `customDates` bleiben zusätzlich wirksam

### Requirement: Löschen eines verwendeten Presets verlangt einen Fallback
Das System SHALL beim Löschen eines referenzierten Abstandspresets eine Fallback-Zuweisung für betroffene Touren erzwingen.

#### Scenario: Benutzer löscht ein verwendetes Preset
- **GIVEN** mindestens eine Tour referenziert das Preset
- **WHEN** ein berechtigter Benutzer das Preset löschen will
- **THEN** verlangt das System die Auswahl eines Fallback-Presets oder eines festen Default-Turnus
- **AND** stellt alle betroffenen Touren serverseitig atomar auf den Fallback um
- **AND** löscht erst danach das Preset
