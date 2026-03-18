## ADDED Requirements

### Requirement: Per-User-Delegation an den SVA-Mainserver

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig und per
Benutzer delegieren. API-Key und Secret werden aus Keycloak-User-Attributen des
aktuellen Benutzers gelesen und nicht im Browser, in Sessions oder in der
Studio-Datenbank gespiegelt.

#### Scenario: Serverseitiger Mainserver-Aufruf mit User-Attributen

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf für einen authentifizierten Benutzer ausführt
- **THEN** liest das System `sva_mainserver_api_key` und `sva_mainserver_api_secret` aus Keycloak-User-Attributen dieses Benutzers
- **AND** fordert serverseitig ein OAuth2-Access-Token an
- **AND** sendet den GraphQL-Aufruf mit `Authorization: Bearer <token>` an den SVA-Mainserver
- **AND** exponiert weder Credentials noch Access-Token an Browser-Code

#### Scenario: Fehlende Mainserver-Credentials im Benutzerprofil

- **WHEN** für den aktuellen Benutzer ein API-Key oder Secret in Keycloak fehlt
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** das System liefert einen stabilen Fehlerzustand `missing_credentials`

### Requirement: Instanzgebundene Mainserver-Endpunktkonfiguration

Das System SHALL pro `instanceId` eine aktive Mainserver-Integration mit
GraphQL- und OAuth2-Endpunktkonfiguration führen.

#### Scenario: Aktive Konfiguration für eine Instanz vorhanden

- **WHEN** das System einen Mainserver-Aufruf für eine `instanceId` vorbereitet
- **THEN** lädt es die aktive Konfiguration für `provider_key = 'sva_mainserver'`
- **AND** verwendet `graphql_base_url` und `oauth_token_url` aus dieser Konfiguration

#### Scenario: Keine aktive Konfiguration für eine Instanz vorhanden

- **WHEN** für die angefragte `instanceId` keine aktive `sva_mainserver`-Konfiguration existiert
- **THEN** wird kein Downstream-Aufruf gestartet
- **AND** das System liefert einen deterministischen Integrationsfehler

### Requirement: Audit-Trail bei Mainserver-Zugriffsversuchen

Das System SHALL sicherheitsrelevante Zugriffsversuche und Fehler bei der
Mainserver-Delegation strukturiert loggen, damit Produktionsprobleme anhand
der Logs nachvollzogen werden können.

#### Scenario: Audit-Trail bei gescheitertem Mainserver-Zugriff

- **WHEN** ein Mainserver-Aufruf fehlschlägt (Credentials fehlen, Token-Abruf scheitert, Upstream nicht erreichbar)
- **THEN** wird ein strukturierter Log-Eintrag geschrieben
- **AND** der Log-Eintrag enthält `workspace_id`, `instance_id`, `error_code`, `request_id` und `trace_id`
- **AND** der Log-Eintrag enthält keine Credentials, Tokens oder personenbezogenen Daten

#### Scenario: Audit-Trail bei Zugriffsverweigerung durch fehlende Rollen

- **WHEN** ein Benutzer ohne ausreichende lokale Studio-Rolle einen Mainserver-Aufruf auslöst
- **THEN** wird der Zugriff verweigert
- **AND** ein Warn-Level-Log mit `operation`, `instance_id` und `request_id` wird geschrieben (ohne PII)

### Requirement: Resilienz bei nicht reagierendem Mainserver

Das System SHALL HTTP-Timeouts für alle Upstream-Aufrufe erzwingen, damit ein
nicht reagierender Mainserver die Studio-Instanz nicht blockiert.

#### Scenario: Timeout bei Mainserver-Aufruf

- **WHEN** ein OAuth2-Token-Abruf oder GraphQL-Aufruf nicht innerhalb des konfigurierten Timeouts antwortet
- **THEN** wird der Aufruf abgebrochen
- **AND** das System liefert einen deterministischen Fehler `network_error`
- **AND** ein strukturierter Log-Eintrag mit Timeout-Details wird geschrieben

### Requirement: SSRF-Schutz für Upstream-URLs

Das System SHALL Upstream-URLs aus der Instanzkonfiguration vor Verwendung
validieren, damit keine Server-Side-Request-Forgery möglich ist.

#### Scenario: Validierung der Upstream-URLs

- **WHEN** die Instanzkonfiguration `graphql_base_url` oder `oauth_token_url` enthält
- **THEN** werden nur URLs mit `https://`-Schema und nicht-interner Adresse akzeptiert
- **AND** URLs mit internen/lokalen Adressen oder nicht-HTTPS-Schema werden abgelehnt
