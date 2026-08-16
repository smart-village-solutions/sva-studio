## ADDED Requirements

### Requirement: News-Kompatibilitätsfelder bleiben snapshotbasiert und verlustfrei

Der News-Editor MUST historische Compatibility-Aliaswerte nur bei einem ausdrücklich gesetzten Touched-Marker und passendem Laufzeittyp in den bestehenden Legacy-Snapshot übernehmen. Vereinfachte redaktionelle Felder MUST bei der Mutation führend bleiben; Publication-, Push-, Address- und ContentBlocks-Sonderregeln MUST ihre bestehende Priorität behalten.

#### Scenario: Unberührter oder typfalscher Alias wird ignoriert

- **WHEN** ein Compatibility-Alias keinen Touched-Marker besitzt, ausdrücklich unberührt ist oder einen falschen Laufzeittyp trägt
- **THEN** bleibt der vorhandene Snapshotwert unverändert
- **AND** die Mutation übernimmt keinen typfalschen Aliaswert

#### Scenario: Mehrere gültige Aliase werden gemeinsam übernommen

- **WHEN** mehrere Compatibility-Aliase als berührt markiert sind und passende Laufzeittypen tragen
- **THEN** aktualisiert der Editor alle zugehörigen Snapshotwerte
- **AND** nicht berührte bestehende Snapshotwerte bleiben erhalten

#### Scenario: Vereinfachte redaktionelle Felder widersprechen Legacy-Inhalten

- **WHEN** vereinfachte Titel-, Intro-, Body- oder Medienwerte gleichzeitig widersprüchliche Compatibility-ContentBlocks begleiten
- **THEN** schreibt die Create- oder Edit-Mutation die vereinfachten redaktionellen Werte
- **AND** die Compatibility-Werte ändern keine öffentliche Form- oder API-Semantik
