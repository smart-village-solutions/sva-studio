## MODIFIED Requirements

### Requirement: Host-Owned External Interface Registry

The system SHALL persist externally managed technical interfaces in a central, host-owned registry.

#### Scenario: Mainserver, S3, Supabase and PostgreSQL share one registry path

- **WHEN** an instance stores a `sva_mainserver`, `s3`, `supabase` or `postgresql` interface
- **THEN** the configuration is persisted in the central external-interface registry
- **AND** the host remains responsible for default resolution, status projection and authorization boundaries

## ADDED Requirements

### Requirement: PostgreSQL-Schnittstellen besitzen einen providerneutralen Vertrag

Das System SHALL PostgreSQL-Datenbanken ohne Supabase-spezifische Pflichtfelder als technischen Schnittstellentyp `postgresql` verwalten.

#### Scenario: PostgreSQL-Verbindung wird vollständig serverseitig gespeichert

- **WHEN** ein berechtigter Benutzer eine PostgreSQL-Schnittstelle anlegt oder aktualisiert
- **THEN** speichert der Host die `databaseUrl` ausschließlich verschlüsselt
- **AND** kann ein optionales `schemaName` als öffentliche technische Konfiguration hinterlegt werden
- **AND** verlangt der Vertrag weder eine Supabase-Projekt-URL noch einen Service-Role-Key

#### Scenario: PostgreSQL-Healthcheck verwendet die Datenbankverbindung

- **WHEN** der Host den Zustand einer PostgreSQL-Schnittstelle prüft
- **THEN** führt er serverseitig eine minimale PostgreSQL-Verbindungsprüfung aus
- **AND** verwendet er keine Supabase-Storage- oder andere providerspezifische HTTP-API

#### Scenario: Supabase bleibt als eigenständiger Schnittstellentyp verfügbar

- **WHEN** der Schnittstellentyp `postgresql` eingeführt wird
- **THEN** bleibt der bestehende Typ `supabase` für unabhängige Integrationen registrier- und konfigurierbar
- **AND** PostgreSQL-Waste-Verbindungen werden nicht als Supabase maskiert
