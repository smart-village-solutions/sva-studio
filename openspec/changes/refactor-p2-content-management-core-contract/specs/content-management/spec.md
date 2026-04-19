## ADDED Requirements

### Requirement: Der Content-Kern bleibt minimal und hostgeführt

Das System SHALL einen kleinen, hostgeführten Content-Kern für Felder, Statusmodell, Historie und Basisvalidierung beibehalten.

#### Scenario: Fachspezifische Erweiterung ergänzt den Kern nur additiv

- **WHEN** ein Plugin oder Fachmodul einen Content-Typ erweitert
- **THEN** ergänzt es den hostgeführten Kern nur additiv
- **AND** Core-Felder, Statusmodell und Historiensemantik bleiben unverändert maßgeblich

#### Scenario: Fachanforderung wird nicht in den Kern hineingezogen

- **WHEN** eine neue Domäne zusätzliche Felder oder UI-Spezialisierung benötigt
- **THEN** wird diese Anforderung als registrierte Erweiterung modelliert
- **AND** der Content-Kern wächst nicht um domänenspezifische Sondersemantik

### Requirement: Kernworkflows bleiben systemweit konsistent

Das System SHALL Erstellen, Bearbeiten, Statuswechsel und Historie als systemweit konsistente Kernworkflows behandeln.

#### Scenario: Plugin nutzt denselben Kernworkflow

- **WHEN** ein pluginbezogener Inhalt bearbeitet oder veröffentlicht wird
- **THEN** bleibt der zugrunde liegende Kernworkflow systemweit konsistent
- **AND** Fachspezialisierung verändert nicht die Bedeutung des Kernablaufs
