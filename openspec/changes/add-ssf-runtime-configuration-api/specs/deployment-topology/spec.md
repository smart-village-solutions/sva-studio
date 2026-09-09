## ADDED Requirements

### Requirement: Das SSF-Plugin besitzt eine getrennte installationsweite Konfigurationsdatenbank

Das System SHALL pro gemeinsam betriebener Studio-/SSF-Installation genau eine
PostgreSQL-Datenbank für SSF-Plugin-Konfiguration betreiben. Diese Datenbank
MUST von der zentralen Studio-Datenbank und den SSF-Laufzeitdatenbanken
getrennt sein, einen eigenen Migrations- und Backupvertrag besitzen und alle
Tenantdaten über die kanonische Studio-`instanceId` isolieren.

#### Scenario: Deployment mit SSF-Plugin provisioniert genau eine Datenbank

- **GIVEN** die SSF-Plugin-Distribution ist im Studio-Deployment installiert
- **WHEN** das SSF-fähige Serverprofil ausgerollt wird
- **THEN** steht genau eine migrationsfähige SSF-Plugin-Konfigurationsdatenbank zur Verfügung
- **AND** verwenden alle SSF-Tenants dieser Installation dieselbe Datenbank mit erzwungener Tenant-Isolation
- **AND** greift SSF nicht direkt auf diese Datenbank zu

#### Scenario: Deployment ohne SSF-Plugin benötigt keine SSF-Datenbank

- **GIVEN** das SSF-Plugin ist nicht Teil des installierten Plugin-Katalogs
- **WHEN** Studio ausgerollt wird
- **THEN** benötigt der Studio Core keine SSF-Plugin-Datenbank oder SSF-spezifische Secrets
- **AND** bleiben generische Studio-Funktionen unverändert verfügbar

#### Scenario: Backup trennt Studio-, Plugin- und SSF-Laufzeitdaten

- **GIVEN** ein SSF-fähiges Deployment wird gesichert oder wiederhergestellt
- **WHEN** der bestehende Backup-/Restore-Vertrag sein Inventar bildet
- **THEN** behandelt er zentrale Studio-Datenbank und SSF-Plugin-Datenbank als getrennte persistente Ziele
- **AND** vermischt er sie nicht mit ClickHouse-, Session- oder Gesprächsdaten

### Requirement: Jede Umgebung besitzt eine getrennte SSF-Runtime-Service-Identität

Das System SHALL im Studio-Root-Realm jeder Umgebung genau einen vertraulichen
Client `ssf-runtime` für Runtime Configuration V1 betreiben. Der Client MUST
ausschließlich den verwalteten Audience-Mapper `sva-studio-ssf-runtime` und als
SSF-Anwendungsaction `ssf.runtime-configuration.read` erhalten; sein Secret MUST außerhalb von Git,
Logs und API-Antworten an das SSF-Deployment übergeben werden.

#### Scenario: Der technische Client wird idempotent abgeglichen

- **GIVEN** ein authentifizierter Operator hat Zugriff auf den Studio-Root-Realm
- **WHEN** er den SSF-Runtime-Service-Client abgleicht
- **THEN** sind Service-Account und Client-Authentisierung aktiviert
- **AND** bleiben Standard-, Implicit- und Direct-Access-Grant-Flows deaktiviert
- **AND** besitzt der Service-Account ausschließlich die vorgesehene Client-Action

#### Scenario: Umgebungen teilen kein Client-Secret

- **GIVEN** Entwicklung, Staging und Produktion betreiben getrennte Studio-Umgebungen
- **WHEN** ihre SSF-Runtime-Identitäten provisioniert oder rotiert werden
- **THEN** verwendet jede Umgebung einen lokalen Issuer und ein eigenes Secret
- **AND** wird kein Secret zwischen Umgebungen oder Studio-Installationen wiederverwendet
