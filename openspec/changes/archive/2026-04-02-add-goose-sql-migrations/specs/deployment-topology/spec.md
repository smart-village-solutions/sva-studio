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

#### Scenario: Acceptance-Migration nutzt gepinntes Goose ohne Vorinstallation

- **WHEN** der dokumentierte Acceptance-Migrationspfad ausgeführt wird
- **THEN** verwendet er eine gepinnte `goose`-Version
- **AND** setzt keine permanente `goose`-Installation auf dem Zielserver voraus
- **AND** beschreibt, wie Binary und Migrationsbundle temporär in den Zielkontext gelangen oder dort reproduzierbar bereitgestellt werden
