## MODIFIED Requirements

### Requirement: Publishable Packages und Plugins

Das System SHALL Packages als eigenstaendige npm-Module organisieren, inklusive klarer Namenskonventionen fuer Core und Plugins. Plugins SHALL dabei ausschliesslich ueber `@sva/sdk` mit dem Host-System kommunizieren und duerfen keine direkten Abhaengigkeiten auf `@sva/core` oder andere interne Packages deklarieren. Ein Beispiel-Plugin ist dafuer keine verpflichtende Workspace-Komponente.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie `@sva/*`
- **AND** Plugins verwenden `@sva/plugin-*`

#### Scenario: Plugin-Dependency-Regel
- **WHEN** ein Plugin-Package erstellt oder aktualisiert wird
- **THEN** listet seine `package.json` nur `@sva/sdk` als Workspace-Dependency
- **AND** direkte Abhaengigkeiten auf `@sva/core` oder andere interne Packages sind nicht vorhanden

#### Scenario: Kein Beispiel-Plugin als Workspace-Pflicht
- **WHEN** der Workspace produktiv konfiguriert wird
- **THEN** ist kein `plugin-example`-Package als verpflichtender Bestandteil vorausgesetzt
- **AND** das Monorepo kann produktive Plugins ohne ein mitgefuehrtes Referenz-Plugin betreiben
