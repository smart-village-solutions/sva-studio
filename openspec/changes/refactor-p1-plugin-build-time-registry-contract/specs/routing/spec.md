## MODIFIED Requirements

### Requirement: Plugin-Route-Exports

Plugins SHALL eigene Routen ausschließlich als Teil des kanonischen Build-time-Registry-Vertrags bereitstellen können. Der Host übergibt diese Plugin-Definitionen an `@sva/routing`, das daraus deterministisch den gemeinsamen Route-Baum materialisiert.

#### Scenario: Routing materialisiert Plugin-Routen aus der kanonischen Host-Registry

- **WHEN** der Studio-Host den Router erzeugt
- **THEN** erhält `@sva/routing` die Plugin-Definitionen aus der kanonischen Build-time-Pluginliste
- **AND** Plugin-Routen werden ohne app-lokale Parallel-Registrierung in den Route-Baum aufgenommen

#### Scenario: Plugin-Routen bleiben Host-kontrolliert

- **WHEN** ein Plugin eigene Routen bereitstellt
- **THEN** bestimmt der Host weiterhin die Materialisierung, Guard-Anwendung und Einbindung in den finalen Route-Baum
- **AND** das Plugin erzeugt keinen separaten Routing-Pfad außerhalb der kanonischen Registry

## ADDED Requirements

### Requirement: Routing verwendet keine parallele Plugin-Quellen

Das System SHALL für Plugin-Routing keine zweite, von der kanonischen Build-time-Pluginliste getrennte Beitragsquelle verwenden.

#### Scenario: Gleiche Pluginquelle für Registry und Router

- **WHEN** Plugin-Identität und Plugin-Routen geprüft werden
- **THEN** stammen beide aus derselben kanonischen Pluginliste
- **AND** Abweichungen zwischen Registry und Route-Materialisierung werden als Vertragsverletzung behandelt

#### Scenario: Ungültiger Plugin-Beitrag blockiert die Routerzeugung

- **WHEN** ein Plugin eine ungültige oder widersprüchliche Routen-Definition in die kanonische Liste einbringt
- **THEN** schlägt die Host-Materialisierung vor dem finalen Router-Build fehl
- **AND** der Host erzeugt keinen teilweise materialisierten Route-Baum
