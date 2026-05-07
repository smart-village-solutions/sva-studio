## ADDED Requirements

### Requirement: Hostvalidierte Invalidation-Tags für Mutationen

Das System SHALL für host- und pluginseitige Inhaltsmutationen einen gemeinsamen Invalidation-Tag-Vertrag bereitstellen, damit Query-Caches paketübergreifend konsistent invalidiert werden.

#### Scenario: Plugin-Mutation ändert hostrelevante Daten

- **GIVEN** ein Plugin führt eine Mutation aus, die Listen-, Detail- oder Dashboard-Daten der Core-App beeinflusst
- **WHEN** die Mutation erfolgreich abgeschlossen wird
- **THEN** emittiert der Pfad hostvalidierte Invalidation-Tags für die betroffenen Datenbereiche
- **AND** die Core-App invalidiert die zugeordneten Queries zentral statt auf pluginlokale Sonderfälle zu vertrauen

#### Scenario: Mutation ohne bekannte Invalidation-Tags

- **GIVEN** eine Mutation deklariert keine oder nur ungültige Invalidation-Tags
- **WHEN** der Host den Mutationsvertrag validiert oder ausführt
- **THEN** fällt der Pfad auf einen dokumentierten fail-closed oder konservativen Invalidierungsmodus zurück
- **AND** die Mutation bleibt nicht stillschweigend cache-inkonsistent
