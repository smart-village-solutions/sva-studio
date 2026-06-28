## ADDED Requirements
### Requirement: Lokaler Bootstrap bewahrt bestehende Umgebungsidentität

Das System SHALL fuer bestehende lokale Instanzdatenbanken den normalen Startpfad, explizite Registry-Korrektur und tenant-spezifische Secret-Reparatur trennen.

#### Scenario: Bestehende lokale Instanz wird nicht beim Start ueberschrieben

- **WHEN** eine bereits konfigurierte lokale Instanzdatenbank erneut ueber `pnpm env:up:local-keycloak` gestartet wird
- **THEN** bleiben bestehende Host-, Realm- und Client-Identitaeten unveraendert
- **AND** werden Abweichungen nur als Drift sichtbar gemacht

#### Scenario: Lokaler Repair nutzt vorhandene Provisioning-Vertraege

- **WHEN** `pnpm env:repair:local-keycloak` eine lokale Instanz mit fehlenden tenant-spezifischen Secrets oder Registry-Drift bearbeitet
- **THEN** verwendet der Repair-Pfad dieselben Provisioning- und Registry-Vertraege wie die vorhandene Instanzverwaltung
- **AND** fuehrt keine parallelen Direkt-SQL-Pfade fuer Secret-Heilung ein

### Requirement: Gefaehrlicher lokaler Bootstrap benoetigt explizite Freigabe

Das System SHALL repo-gesteuerte lokale Bootstrap-Pfade fuer bestehende oder neu anzulegende Instanzdatenbanken nur mit expliziter Freigabe ausfuehren.

#### Scenario: Lokaler Instanz-DB-Bootstrap bleibt ohne Approval gesperrt

- **WHEN** `pnpm env:bootstrap:local-instance-db` eine lokale Zielinstanz initialisieren oder neu aufbauen soll
- **THEN** blockiert das Skript den Lauf ohne passenden `--approve-dangerous=bootstrap-local-instance-db:<target-instance-id>`
- **AND** nennt die Fehlermeldung den exakt erwarteten Freigabetoken

### Requirement: Lokaler DB-Snapshot bleibt migrationsbasiert ableitbar

Das System SHALL den eingecheckten DB-Snapshot als aus Migrationen ableitbares Artefakt behandeln.

#### Scenario: Snapshot-Check erkennt nicht migrierte Objekte

- **WHEN** `pnpm env:verify:db-schema-snapshot` gegen den lokalen Datenbankstand ausgefuehrt wird
- **THEN** schlaegt der Befehl fehl, wenn der Snapshot Objekte enthaelt, die der migrationsbasierte Datenbankstand nicht besitzt
- **AND** meldet er fehlende und unerwartete Objekte maschinenlesbar

#### Scenario: Runtime-Schemas werden aus dem Snapshot-Check ausgeschlossen

- **WHEN** der Snapshot-Check einen lokalen Datenbank-Dump mit reinen Runtime- oder Infra-Schemas liest
- **THEN** ignoriert der Check mindestens `graphile_worker`
- **AND** behandelt diese Schemata nicht als fachliche Snapshot-Drift
