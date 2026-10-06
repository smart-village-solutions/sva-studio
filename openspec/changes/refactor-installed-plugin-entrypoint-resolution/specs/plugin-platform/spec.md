## ADDED Requirements

### Requirement: Installierte Plugin-Entrypoints folgen dem gewählten Manifest

Das System SHALL für installierte Plugin-Distributionen ausschließlich die für den Build ausgewählten Katalogquellen und deren validierte Manifest-Entrypoints für Browser, Descriptor, Server und Jobs verwenden. Paketnamen und Entry-Dateinamen MUST unabhängig von einem `plugin-*`-Präfix oder festen `dist/index.js`-/`dist/server.js`-Pfaden sein.

#### Scenario: Gewählte Distribution mit eigenen Dateinamen

- **GIVEN** ein installiertes Paket `@vendor/calendar` deklariert getrennte Browser-, Descriptor-, Server- und Job-Dateien und ist für den Build ausgewählt
- **WHEN** der Host den Build erstellt und den Plugin-Snapshot materialisiert
- **THEN** löst er genau diese Dateien aus dem installierten Paket auf
- **AND** Browser, Server und Jobs verwenden dieselbe validierte Plugin-Quelle
- **AND** eine App-Quellcodeänderung für den Paketnamen oder Dateinamen ist nicht erforderlich

#### Scenario: Nicht gewähltes Paket bleibt außerhalb des Artefakts

- **GIVEN** ein anderes Plugin-Paket ist installiert, aber für den Build nicht ausgewählt
- **WHEN** die Browser-, Server- und Worker-Artefakte erstellt werden
- **THEN** enthalten ihre Runtime-Importgraphen und registrierten Beiträge dieses Paket nicht

#### Scenario: Deklarierter Entrypoint fehlt oder verlässt das Paket

- **GIVEN** ein gewähltes installiertes Plugin deklariert einen fehlenden, ungültigen oder außerhalb seines Pakets liegenden Entrypoint
- **WHEN** der Build die installierten Plugin-Quellen vorbereitet
- **THEN** scheitert er deterministisch vor Veröffentlichung des Artefakts
- **AND** kein partieller Plugin-Snapshot wird veröffentlicht
