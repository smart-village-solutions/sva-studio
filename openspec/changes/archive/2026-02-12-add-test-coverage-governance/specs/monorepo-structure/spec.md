## MODIFIED Requirements

### Requirement: Build- und Target-Konventionen
Das System SHALL standardisierte Nx Targets für build, lint und Testarten bereitstellen, mit klarer Trennung zwischen Unit-, Coverage- und Integrationstests.

#### Scenario: Standardisierte Targets
- **WHEN** ein neues Package oder eine App erstellt wird
- **THEN** sind mindestens `build`, `lint` und ein Testtarget definiert
- **AND** Target-Namen folgen Workspace-Konventionen

#### Scenario: Testtarget-Konvention
- **WHEN** ein Projekt Tests ausführt
- **THEN** nutzt es `test:unit` für stabile Unit-Tests
- **AND** nutzt es `test:coverage` für Coverage-Erzeugung
- **AND** nutzt es `test:integration` für infra-abhängige Tests

#### Scenario: Targets im Projektgraph sichtbar
- **WHEN** `nx graph` ausgeführt wird
- **THEN** sind Testtargets und deren Abhängigkeiten sichtbar
- **AND** affected-Commands funktionieren zuverlässig für Testtargets
