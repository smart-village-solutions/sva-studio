## MODIFIED Requirements

### Requirement: Einheitlicher Plugin-Plattformvertrag

Das System SHALL einen kanonischen Plugin-Plattformvertrag für interne und externe Plugins bereitstellen. Dieser Vertrag umfasst Authoring, Distribution, Installation, Snapshot-Materialisierung und Runtime-Execution. Ein Studio-Artefakt MUST seine vollständige installierte Workspace-Plugin-Menge über eine explizite, validierte Build-Auswahl bestimmen. Browser-, Server-, Worker-, Routing-, IAM-, Modul- und Job-Beiträge MUST aus genau dieser Auswahl hervorgehen.

#### Scenario: Interner und externer Plugin-Pfad nutzen denselben Plattformvertrag

- **GIVEN** ein Plugin wird lokal als Workspace-Package entwickelt
- **AND** ein anderes Plugin wird als veröffentlichte Distribution installiert
- **WHEN** der Host beide Plugins lädt
- **THEN** validiert und materialisiert er beide über denselben kanonischen Plattformvertrag
- **AND** Routing, IAM, Audit, Jobs und Navigation konsumieren denselben Snapshot-Typ

#### Scenario: Explizite Workspace-Plugin-Menge wird gebaut

- **GIVEN** der Build erhält eine nicht leere, eindeutige Menge unterstützter Workspace-Plugin-IDs
- **WHEN** er das Studio-Artefakt erzeugt
- **THEN** enthält das Artefakt genau die ausgewählten Workspace-Plugin-Beiträge und deren notwendigen Laufzeitabhängigkeiten
- **AND** Manifest, Runtime-Snapshot und Artefaktinventar weisen dieselbe Menge aus

#### Scenario: Nicht ausgewähltes Plugin wird ausgeschlossen

- **GIVEN** ein Workspace-Plugin ist nicht in der Build-Auswahl enthalten
- **WHEN** das Artefakt gebaut und verifiziert wird
- **THEN** enthält es keine ausführbaren Browser-, Server- oder Job-Beiträge dieses Plugins
- **AND** das Plugin liefert keine Routen, Navigation, IAM-/OIDC- oder Modulbeiträge
- **AND** das Verifikations-Gate weist das Plugin als ausgeschlossen nach

#### Scenario: Ungültige Plugin-Auswahl stoppt den Build

- **GIVEN** die Auswahl enthält unbekannte oder doppelte Plugin-IDs oder eine nicht unterstützte Plugin-Kombination
- **WHEN** die Build-Auswahl validiert wird
- **THEN** schlägt die Validierung mit einem stabilen Fehlercode fehl
- **AND** wird kein partielles oder missdeutbares Artefakt veröffentlicht

#### Scenario: Bestehende Standarddistributionen bleiben stabil

- **GIVEN** der Build wird ohne neue Plugin-Mengeneingabe mit `studio` oder `ssf` gestartet
- **WHEN** das jeweilige Artefakt gebaut und geprüft wird
- **THEN** entspricht seine Plugin-Menge weiterhin dem bestehenden Distributionsvertrag
- **AND** Repository, Image-Digest und Distribution bleiben eindeutig gebunden
