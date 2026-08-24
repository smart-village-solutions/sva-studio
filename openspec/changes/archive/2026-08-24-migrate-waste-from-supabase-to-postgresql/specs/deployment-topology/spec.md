## ADDED Requirements

### Requirement: Waste-Fachdatenbank wird getrennt und wiederherstellbar betrieben

Das System SHALL die Waste-Fachdatenbank als separate Datenbank mit eigenem Zugriffsvertrag in der PostgreSQL-Betriebsumgebung bereitstellen.

#### Scenario: Studio- und Waste-Datenbanken teilen keinen fachlichen Datenbankvertrag

- **WHEN** Studio und Waste auf derselben PostgreSQL-Serverinstanz betrieben werden
- **THEN** verwendet Waste die getrennte Datenbank `sva_waste`
- **AND** besitzt `sva_waste_owner` als `NOLOGIN`-Rolle die Waste-Objekte
- **AND** sind `sva_waste_migrator`, `sva_waste_app` und `sva_waste_public_app` nach Migration, administrativer Runtime und öffentlicher Runtime getrennt
- **AND** erhalten die Waste-Rollen keinen regulären Zugriff auf Studio-Governance-Daten
- **AND** die Studio-Runtime erhält keinen impliziten Vollzugriff auf die Waste-Datenbank

#### Scenario: Backup umfasst die Waste-Fachdatenbank

- **WHEN** der kanonische Datenbank-Backup-Ablauf einer Umgebung ausgeführt wird
- **THEN** erzeugt er auch für die aktive Waste-Fachdatenbank einen überprüfbaren PostgreSQL-Dump
- **AND** ordnet er Artefakt, Integritätsnachweis und Aufbewahrung eindeutig der Umgebung und Datenbank zu

#### Scenario: Restore der Waste-Fachdatenbank wird nachgewiesen

- **WHEN** die Betriebsbereitschaft der Waste-Datenbank abgenommen wird
- **THEN** wird ein Restore in ein isoliertes Ziel erfolgreich durchgeführt
- **AND** werden Schema, Migrationen und repräsentative Read-Pfade mit der vorgesehenen Runtime-Rolle geprüft

### Requirement: Waste-Cutover folgt dem kanonischen Studio-Rollout-Prozess

Das System SHALL den einmaligen Datenbank-Cutover als kontrollierten Betriebsbaustein innerhalb des bestehenden Studio-Rollout-Prozesses ausführen.

#### Scenario: Runbook definiert keinen konkurrierenden Deploypfad

- **WHEN** der Supabase-zu-PostgreSQL-Cutover dokumentiert oder ausgeführt wird
- **THEN** bleiben Build, Dev-, Staging- und Production-Promotion an `docs/guides/studio-rollout-process.md` gebunden
- **AND** beschreibt das Cutover-Runbook ausschließlich den angekündigten Betriebsstopp sowie zusätzliche Datenmigrations-, Verifikations- und Rollback-Schritte
- **AND** führt der Change keinen dauerhaften Anwendungs-Wartungsmodus ein
