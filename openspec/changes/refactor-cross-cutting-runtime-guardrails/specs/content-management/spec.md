## ADDED Requirements

### Requirement: Hostvalidierte Invalidation-Tags fuer Mutationen

Das System SHALL fuer host- und pluginseitige Inhaltsmutationen einen gemeinsamen Invalidation-Tag-Vertrag bereitstellen, damit Query-Caches paketuebergreifend konsistent invalidiert werden.

#### Scenario: Plugin-Mutation aendert hostrelevante Daten

- **GIVEN** ein Plugin fuehrt eine Mutation aus, die Listen-, Detail- oder Dashboard-Daten der Core-App beeinflusst
- **WHEN** die Mutation erfolgreich abgeschlossen wird
- **THEN** emittiert der Pfad hostvalidierte Invalidation-Tags fuer die betroffenen Datenbereiche
- **AND** die Core-App invalidiert die zugeordneten Queries zentral statt auf pluginlokale Sonderfaelle zu vertrauen

#### Scenario: Mutation ohne bekannte Invalidation-Tags

- **GIVEN** eine Mutation deklariert keine oder nur ungueltige Invalidation-Tags
- **WHEN** der Host den Mutationsvertrag validiert oder ausfuehrt
- **THEN** faellt der Pfad auf einen dokumentierten fail-closed oder konservativen Invalidierungsmodus zurueck
- **AND** die Mutation bleibt nicht stillschweigend cache-inkonsistent
