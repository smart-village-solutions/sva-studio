# iam-program-governance Specification

## Purpose
TBD - created by archiving change add-iam-program-masterplan. Update Purpose after archive.
## Requirements
### Requirement: Verbindliche Masterplan-Governance

Der Masterplan SHALL die IAM-Umsetzung über freigegebene Child-Changes steuern. Direkte Feature-Implementierung im Master-Change ist nicht zulässig.

#### Scenario: Child-Start nur mit Freigabe

- **WHEN** ein Child-Change in die Umsetzung überführt wird
- **THEN** ist dessen Proposal freigegeben
- **AND** dessen Taskliste enthält testbare Akzeptanzkriterien
- **AND** ein eigenes `design.md` mit Architekturentscheidungen und Alternativen-Abwägung liegt vor
- **AND** die Implementierung erfolgt nicht direkt im Master-Change

### Requirement: Verbindliche Programm-Leitplanken

Die folgenden Leitplanken SHALL verbindlich für alle IAM-Child-Changes gelten:

- Phase-1-Umfang: Auth + Session + RBAC-Basis inkl. Multi-Org-Context-Switch
- Kanonischer Scope: `instanceId`
- Instanzmodell: Eine Instanz kann mehrere Organisationen enthalten; Benutzerzuordnungen sind instanzgebunden und organisationsspezifisch
- Hierarchiemodell: beliebig tief
- Rollout: stufenweise per Feature-Flags
- `authorize`-Leistungsziel: P95 < 50 ms
- Cache-Invalidierung: Postgres NOTIFY mit TTL-/Recompute-Fallback
- Impersonation: Ticketpflicht + Vier-Augen-Freigabe + zeitliche Begrenzung
- Audit/Compliance: PII-minimiert, Exportformate CSV/JSON/SIEM
- Audit-Retention: 24 Monate (konfigurierbar, bestätigt 26.02.2026)
- PII-Pseudonymisierung: Klartext-PII (E-Mail, IP, User-Agent) werden in Audit-Logs durch pseudonymisierte Referenzen ersetzt; Re-Identifikation nur durch autorisiertes Personal mit dokumentiertem Grund
- Encryption at Rest: Sensible IAM-Daten werden verschlüsselt gespeichert, wo sinnvoll und notwendig
- DSGVO-Betroffenenrechte (Art. 15–21): In separatem Child-Change `add-iam-data-subject-rights` adressiert
- Operative Observability: Alle IAM-Server-Module nutzen den Server-Runtime-Logger (`@sva/server-runtime`) gemäß ADR-006; kein `console.log` in IAM-Code
- Logging-Pflichtfelder: `workspace_id` (= `instanceId`), `component`, `environment`, `level`
- Korrelation: Alle IAM-API-Endpunkte propagieren `X-Request-Id` und OTEL-Trace-Context
- Audit Dual-Write: Sicherheitsrelevante Audit-Events werden parallel in DB (`iam.activity_logs`) und OTEL-Pipeline (SDK Logger) emittiert
- Log-Level-Konvention: `error` (Systemfehler, RLS-Bypass), `warn` (Token-Fehler, Denials, Impersonation), `info` (Login, Account-Lifecycle), `debug` (Cache-Ops, Token-Refresh)

#### Scenario: Review eines Child-Changes gegen Leitplanken

- **WHEN** ein Child-Change zur Review gestellt wird
- **THEN** sind dessen Requirements und Tasks mit den Leitplanken kompatibel
- **AND** Abweichungen sind explizit dokumentiert und begründet

### Requirement: Konsistenter Beschlussstand

Die Masterplan-Entscheidungen SHALL im Dokument `decision-checklist.md` gepflegt und mit Proposal/Spec synchron gehalten werden.

#### Scenario: Entscheidungsänderung

- **WHEN** eine bereits bestätigte Leitplanke geändert wird
- **THEN** werden `decision-checklist.md`, Master-Proposal und Master-Spec gemeinsam aktualisiert
- **AND** die betroffenen Child-Changes werden auf Folgewirkungen geprüft

### Requirement: Verbindliche design.md pro Child-Change

Jeder Child-Change SHALL vor Review-Freigabe ein eigenes `design.md` enthalten, das mindestens folgende Inhalte abdeckt:

- Architekturentscheidungen mit Alternativen-Abwägung
- Datenflussdiagramme für sicherheitsrelevante Pfade
- Threat-/Abuse-Betrachtung (mindestens für sicherheitskritische Child-Changes C, D, E, F)
- Explizite Benennung der Negativpfade und deren Testabdeckung

#### Scenario: Child-Change ohne design.md

- **WHEN** ein Child-Change zur Review-Freigabe gestellt wird
- **AND** kein `design.md` mit den oben genannten Inhalten vorliegt
- **THEN** wird die Freigabe blockiert
- **AND** der Review wird erst nach Ergänzung des `design.md` fortgesetzt

### Requirement: Rollback-Fähigkeit für DB-Migrationen

Jeder Child-Change, der Datenbankmigrationen enthält, SHALL eine verifizierte Rollback-Fähigkeit nachweisen.

#### Scenario: Migration mit Rollback-Pfad

- **WHEN** ein Child-Change eine Datenbankmigration enthält
- **THEN** existiert eine zugehörige Down-Migration
- **AND** die Down-Migration wurde in CI oder lokal erfolgreich getestet (up → down → up)
- **AND** destruktive Migrationen (DROP COLUMN, DROP TABLE) sind als solche gekennzeichnet und erfordern ein separates Review-Gate

### Requirement: Keycloak-Härtung als separater Change

Die Keycloak-seitige Sicherheitskonfiguration (MFA, Passwortrichtlinien, Session-Timeouts, Rate-Limiting, Brute-Force-Detection, Keycloak-Versionsfestlegung) SHALL in einem separaten Härtungs-Change nach Abschluss der IAM-Kernentwicklung adressiert werden.

#### Scenario: Keycloak-Härtung nicht im aktuellen Program-Scope

- **WHEN** ein Child-Change Keycloak-seitige Konfigurationsänderungen erfordert (z.B. MFA-Enforcement, Passwortpolicy)
- **THEN** wird dies als deferred dokumentiert und nicht als Blocker für den aktuellen Child-Change behandelt
- **AND** die Anforderung wird im Masterplan unter „Explizit deferred" referenziert

### Requirement: Verbindliche operative Observability für IAM-Module

Alle IAM-Server-Module SHALL den Server-Runtime-Logger (`@sva/server-runtime`, `createSdkLogger`) gemäß ADR-006 verwenden. Operative Logs werden über die OTEL→Collector→Loki-Pipeline exportiert. `console.log`/`console.error` ist in IAM-Server-Code nicht zulässig.

#### Scenario: IAM-Modul ohne Server-Runtime-Logger

- **WHEN** ein Child-Change IAM-Server-Code enthält
- **AND** dieser Code `console.log`, `console.error` oder `console.warn` statt des SDK Loggers verwendet
- **THEN** wird der Review blockiert
- **AND** der Code muss auf `createSdkLogger` umgestellt werden

#### Scenario: Logging-Pflichtfelder in IAM-Logs

- **WHEN** ein IAM-Server-Modul einen Log-Eintrag erzeugt
- **THEN** enthält dieser mindestens: `workspace_id` (= `instanceId`), `component` (z.B. `iam-auth`, `iam-authorize`, `iam-cache`), `environment`, `level`
- **AND** PII-Redaction greift gemäß Observability Best Practices

#### Scenario: Korrelations-IDs in IAM-API-Requests

- **WHEN** ein IAM-API-Endpunkt aufgerufen wird
- **THEN** wird ein `X-Request-Id`-Header propagiert (generiert, falls nicht vorhanden)
- **AND** der OTEL-Trace-Context wird durchgereicht
- **AND** alle Log-Einträge innerhalb des Requests referenzieren `request_id` und `trace_id`

### Requirement: Dual-Write für sicherheitsrelevante Audit-Events

Sicherheitsrelevante IAM-Events SHALL sowohl in die DB (`iam.activity_logs`) als auch über den SDK Logger in die OTEL-Pipeline emittiert werden.

#### Scenario: Audit-Event mit Dual-Write

- **WHEN** ein sicherheitsrelevantes IAM-Event auftritt (z.B. Login, Login-Fehler, Rollenänderung, Impersonation)
- **THEN** wird ein Eintrag in `iam.activity_logs` geschrieben (Compliance-Nachweis)
- **AND** ein strukturierter Log-Eintrag über den SDK Logger emittiert (Echtzeit-Monitoring)
- **AND** beide Einträge referenzieren denselben `request_id`/`trace_id`

#### Scenario: Echtzeit-Alerting für Security-Anomalien

- **WHEN** mehr als 10 fehlgeschlagene Login-Versuche pro Account innerhalb einer Minute auftreten
- **THEN** erzeugt der SDK Logger einen `warn`-Level-Eintrag mit `{ operation: 'login_anomaly', count: N }`
- **AND** dieser Eintrag ist über die OTEL-Pipeline für Grafana-Alerts nutzbar
