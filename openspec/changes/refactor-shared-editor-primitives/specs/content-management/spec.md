## ADDED Requirements

### Requirement: Standardisierte Detaileditor-Bausteine für Content-Plugins

Das System SHALL wiederkehrende technische Detaileditor-Bausteine für standardisierte Content-Plugins über gemeinsame hosteigene UI-Primitives bereitstellen, ohne fachliche Plugin-Logik in den Host zu verschieben.

#### Scenario: Plugin nutzt gemeinsame Editor-Bausteine ohne Fachlogikverlust

- **GIVEN** ein standardisiertes Content-Plugin mit hosteigener CRUD-Einbettung
- **WHEN** es Abschnittsflächen oder wiederholbare Editorbereiche rendert
- **THEN** kann es dafür gemeinsame `studio-ui-react`-Primitives verwenden
- **AND** Mapping, Validierung und Fachregeln bleiben im Plugin

#### Scenario: Gemeinsame UI ersetzt keine Plugin-Fachverträge

- **GIVEN** ein Plugin besitzt eigene Feldmodelle, Validierungsregeln oder Save-Mappings
- **WHEN** gemeinsame Editor-Primitives eingesetzt werden
- **THEN** übernimmt die gemeinsame UI nur Layout- und Formularmuster
- **AND** sie ersetzt nicht die fachlichen Verträge des Plugins

### Requirement: Referenzmigration für gemeinsame Detaileditor-Primitives

Das System SHALL die Extraktion gemeinsamer Detaileditor-Primitives mindestens an zwei realen Content-Editoren verifizieren.

#### Scenario: POI und ein zweiter Editor validieren die Extraktion

- **GIVEN** neue gemeinsame Section- oder Repeater-Primitives werden eingeführt
- **WHEN** der Change abgeschlossen wird
- **THEN** nutzt `@sva/plugin-poi` diese Primitives
- **AND** mindestens ein zweiter produktiver oder referenzrelevanter Content-Editor nutzt denselben Pfad ebenfalls
- **AND** die Extraktion bleibt damit an realer Mehrfachnutzung statt an spekulativer Abstraktion verankert
