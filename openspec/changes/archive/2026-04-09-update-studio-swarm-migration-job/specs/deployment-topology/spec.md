## MODIFIED Requirements
### Requirement: Minimaler Betriebsvertrag für stateful Swarm-Services

Das System SHALL dokumentieren, wie stateful Services, Secrets, Configs, Migrationen und Rollback im Swarm-Referenzprofil minimal belastbar betrieben werden.

#### Scenario: Klassifizierung von Secrets und Configs

- **WHEN** ein Team die Runtime-Konfiguration des Swarm-Stacks dokumentiert
- **THEN** trennt die Dokumentation sensitive Secrets von nicht sensitiven Configs
- **AND** hält fest, dass sensitive Werte nicht in allgemeinen Stack-Variablen oder Stack-Dateien abgelegt werden
- **AND** stellt eine verbindliche Klassifizierungstabelle bereit, die jede Runtime-Variable als Secret oder Config einordnet

#### Scenario: Persistenz und Placement für stateful Services

- **WHEN** das Zielbild für Postgres und Redis beschrieben wird
- **THEN** benennt die Dokumentation persistente Volumes und Placement-Annahmen für stateful Services
- **AND** beschreibt einen Restore-Pfad für diese Services

#### Scenario: Kompatibles Rollback-Fenster

- **WHEN** ein Team Rollout und Rollback des Swarm-Stacks dokumentiert
- **THEN** beschreibt die Dokumentation ein kompatibles Rollback-Fenster für App- und Schema-Änderungen
- **AND** grenzt destruktive oder nicht rückwärtskompatible Migrationen aus diesem Change aus

#### Scenario: Acceptance-Migration nutzt dedizierten Swarm-Migrationsjob

- **WHEN** der dokumentierte Acceptance-Migrationspfad ausgeführt wird
- **THEN** verwendet er eine gepinnte `goose`-Version innerhalb eines dedizierten Swarm-One-off-Jobs
- **AND** setzt keine permanente `goose`-Installation auf dem Zielserver voraus
- **AND** basiert die technische Freigabe des Schemarollouts primär auf Job-Exit-Code und Post-Migration-Assertions statt auf geparster Shell-Ausgabe

#### Scenario: Acceptance-Bootstrap nutzt dedizierten Swarm-Bootstrap-Job

- **WHEN** nach einem erfolgreichen Acceptance-Schemarollout App-DB-User, Grants und Instanz-Seeds hergestellt werden
- **THEN** verwendet der dokumentierte Pfad einen dedizierten Swarm-One-off-Job `bootstrap`
- **AND** erfolgt diese Mutation nicht mehr über `quantum-cli exec` oder Marker-geparste Shell-Ausgabe
- **AND** bleibt der Ziel-Stack nach Abschluss bei `replicas: 0` für den Bootstrap-Service
