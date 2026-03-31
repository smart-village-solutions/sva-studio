# iam-core Specification

## Purpose
TBD - created by archiving change setup-iam-identity-auth. Update Purpose after archive.
## Requirements
### Requirement: Keycloak-OIDC-Integration

Das System MUST eine OIDC-basierte Authentifizierung über Keycloak bereitstellen und sicheres Single Sign-on (SSO) sowohl für das SVA Studio CMS als auch für die Smart Village App ermöglichen.

#### Scenario: User logs in via OIDC

- **WHEN** ein Benutzer die CMS-Login-Seite aufruft
- **AND** auf "Login with Keycloak" klickt
- **THEN** wird der Benutzer zur Keycloak-Login-Oberfläche weitergeleitet
- **AND** nach erfolgreicher Anmeldeprüfung
- **THEN** wird der Benutzer mit einem Authorization Code zurück ins CMS geleitet
- **AND** das Backend tauscht den Code gegen ein Access Token
- **AND** eine Benutzersitzung wird aufgebaut

#### Scenario: Invalid or expired token

- **WHEN** eine Anfrage ein ungültiges JWT-Token enthält
- **THEN** antwortet das Backend mit HTTP 401 Unauthorized
- **WHEN** eine Anfrage ein abgelaufenes Access Token enthält
- **THEN** versucht das Backend eine Erneuerung über das Refresh Token
- **AND** wenn die Erneuerung erfolgreich ist, wird die Anfrage erneut ausgeführt
- **AND** wenn die Erneuerung fehlschlägt, wird HTTP 401 zurückgegeben

### Requirement: Token Validation & User Identity
Das System MUST von Keycloak ausgestellte JWT-Tokens validieren und nur die fuer Session- und Autorisierungspfad erforderlichen Identity-Claims extrahieren.

#### Scenario: User context extraction

- **WHEN** ein Token gueltig ist
- **THEN** extrahiert das System mindestens die Claims `sub` (Benutzer-ID), `instanceId` und Rollen-/Berechtigungsinformationen
- **AND** `email` oder `name` sind keine Pflichtclaims fuer Session-Hydration oder Autorisierung
- **AND** zusaetzliche Profildaten werden nur in dedizierten Profil-/Sync-Flows geladen
- **AND** das System injiziert daraus einen minimalen `UserContext` fuer nachgelagerte Handler

### Requirement: Session Management
Das System MUST Benutzersitzungen sicher verwalten, einschließlich serverseitiger Token-Erneuerung, einer fachlich führenden Session-Gültigkeit, Redis-basierter Persistenz aktiver App-Sessions und kontrollierter Wiederherstellung nach Session-Ablauf.

#### Scenario: Serverseitige Session-Erneuerung innerhalb der Maxdauer
- **WHEN** ein Access-Token kurz vor dem Ablauf steht
- **THEN** versucht das BFF serverseitig einen Refresh mit dem gespeicherten Refresh-Token
- **AND** ein erfolgreicher Refresh darf `Session.expiresAt` nur innerhalb der absoluten Session-Maxdauer fortschreiben
- **AND** der Browser erhält weiterhin nur den Session-Cookie und keine OIDC-Tokens

#### Scenario: Fachliche Session-Wahrheit steuert Cookie und Redis
- **WHEN** eine Session erstellt oder aktualisiert wird
- **THEN** ist `Session.expiresAt` die führende fachliche Gültigkeitsquelle
- **AND** Redis-TTL wird nur als technischer Puffer oberhalb der verbleibenden Sessiondauer gesetzt
- **AND** der Session-Cookie lebt nie länger als die fachliche Session

#### Scenario: Session überlebt Server-Neustart
- **WHEN** eine gültige App-Session bereits in Redis persistiert wurde
- **AND** der Serverprozess neu startet
- **THEN** bleibt die Session bis zum Erreichen ihrer fachlichen Gültigkeitsgrenze weiter auflösbar

#### Scenario: Tokens bleiben serverseitig und geschützt
- **WHEN** Access-, Refresh- oder ID-Token im Session-Store persistiert werden
- **THEN** werden diese Werte verschlüsselt gespeichert
- **AND** die Redis-Anbindung verwendet abgesicherte Transport- und Authentifizierungsmechanismen
- **AND** Tokenwerte erscheinen nicht in operativen Logs oder Browser-seitigen Persistenzkanälen

#### Scenario: Logout invalidiert persistierte Session
- **WHEN** ein Benutzer sich explizit abmeldet
- **THEN** invalidiert das System die aktuelle Session im Redis-basierten Store
- **AND** ein automatischer Silent-Reauth-Versuch darf unmittelbar danach nicht erfolgen

#### Scenario: AuthProvider-Recovery nach 401
- **WHEN** `AuthProvider` auf `/auth/me` oder einem geschützten Auth-Read ein `401` erhält
- **THEN** startet das Frontend genau einen stillen Reauth-Versuch
- **AND** bei Erfolg wird `/auth/me` erneut geladen
- **AND** bei Misserfolg bleibt `useAuth()` bei `{ user: null, isAuthenticated: false }`

### Requirement: Multi-Organization Support

Das System MUST Benutzer mit mehreren Organisationszuordnungen unterstützen und organisationsgebundene Datenzugriffe erzwingen.

#### Scenario: User with multiple org memberships

- **WHEN** ein Benutzer Mitglied der Organisationen A, B und C ist
- **THEN** kann der Benutzer in der CMS-Oberfläche zwischen Organisationen wechseln
- **AND** nach dem Wechsel werden alle Datenabfragen auf die ausgewählte Organisation begrenzt
- **AND** Row-Level-Security-Policies erzwingen diese Begrenzung

#### Scenario: Cross-organization data isolation

- **WHEN** Benutzer X (Mitglied in Org A) eine Anfrage stellt
- **THEN** gibt das System KEINE Daten aus Org B oder C zurück
- **AND** selbst bei direkter Datenbankabfrage mit manuellem SQL verhindern RLS-Policies den Zugriff

### Requirement: Audit Logging for IAM Events

Das System MUST alle sicherheitsrelevanten IAM-Ereignisse unveränderbar protokollieren, um Compliance- und Analyseanforderungen zu erfüllen.

#### Scenario: Login attempt logged

- **WHEN** ein Benutzer sich erfolgreich anmeldet
- **THEN** wird ein Ereignis in `iam.activity_logs` mit Zeitstempel, pseudonymisierter Benutzer-ID, anonymisierter IP-Adresse (letztes Oktett entfernt) und User-Agent-Kategorie gespeichert
- **AND** der Log-Eintrag KANN nach Erstellung nicht verändert oder gelöscht werden
- **AND** Klartext-PII (E-Mail, vollständige IP) wird NICHT im Audit-Log gespeichert

#### Scenario: Account creation triggered by first login

- **WHEN** ein Benutzer sich erstmals über ein neues Keycloak-Konto anmeldet
- **THEN** wird ein neuer Account-Datensatz in `iam.accounts` angelegt
- **AND** das Erstellungsereignis wird mit der Keycloak-ID als Verknüpfung protokolliert

### Requirement: SDK Logger for IAM Server Modules
Das System MUST den SDK Logger (`createSdkLogger` aus `@sva/sdk`) fuer alle operativen Logs in IAM-Servermodulen verwenden und tokenhaltige oder personenbeziehbare Werte minimieren.

#### Scenario: Structured logging with mandatory fields

- **WHEN** ein IAM-Servermodul einen Log-Eintrag erzeugt
- **THEN** enthaelt der Eintrag mindestens: `workspace_id` (= `instanceId`), `component` (z. B. `iam-auth`), `environment`, `level`
- **AND** PII-Redaktion wird automatisch durch den SDK Logger angewendet
- **AND** es erscheinen keine Klartext-Tokens, tokenhaltigen Redirect-URLs, Session-IDs oder E-Mail-Adressen in operativen Logs

### Requirement: Governance-Funktionen nur für berechtigte Identitäten

Das System SHALL Governance-Aktionen ausschließlich für authentifizierte und explizit berechtigte Identitäten im aktiven Instanzkontext zulassen.

#### Scenario: Unberechtigter Zugriff auf Governance-Aktion

- **WHEN** ein Benutzer ohne Governance-Berechtigung eine Workflow-Aktion ausführt
- **THEN** wird die Aktion abgewiesen
- **AND** ein Sicherheitsereignis wird protokolliert

### Requirement: Sichtbarer Identitätswechsel bei Impersonation

Das System SHALL bei aktiver Impersonation den effektiven Benutzerkontext eindeutig kennzeichnen.

#### Scenario: Anfrage während Impersonation

- **WHEN** eine Anfrage in einer aktiven Impersonation-Sitzung gestellt wird
- **THEN** enthält der Kontext sowohl Ursprung als auch impersonierte Identität
- **AND** die Anfrage bleibt auf die freigegebene Dauer und `instanceId` begrenzt

### Requirement: Self-Service für Betroffenenanfragen

Das System SHALL authentifizierten Benutzern einen Self-Service-Zugang für Betroffenenanfragen im eigenen Identitätskontext bereitstellen.

#### Scenario: Benutzer stellt eigene DSGVO-Anfrage

- **WHEN** ein authentifizierter Benutzer eine Anfrage zu Auskunft, Berichtigung oder Löschung erstellt
- **THEN** wird die Anfrage eindeutig seiner Identität zugeordnet
- **AND** der Status ist für den Benutzer nachvollziehbar einsehbar

### Requirement: Instanzgebundene Verarbeitung von Betroffenenrechten

Das System SHALL Betroffenenanfragen strikt im aktiven `instanceId`-Kontext verarbeiten.

#### Scenario: Anfrage über Instanzgrenze

- **WHEN** eine Anfrage auf Daten außerhalb der aktiven Instanz zielt
- **THEN** wird die Verarbeitung abgelehnt
- **AND** ein entsprechender Denial-Eintrag wird erzeugt

### Requirement: IAM-Datenbank-Schema (Delta-Migration)

Das bestehende IAM-Schema (`0001_iam_core.sql`) liefert bereits Multi-Tenancy (`instance_id` + RLS), PII-Verschlüsselung (`*_ciphertext`, ADR-010) und Activity-Logging. Die Delta-Migration MUST Profil-Felder und Audit-Erweiterungen ergänzen – kein Ersatz des bestehenden Schemas.

#### Scenario: Profil-Erweiterung der Accounts-Tabelle

- **WENN** die Delta-Migration ausgeführt wird
- **DANN** werden der Tabelle `iam.accounts` die Spalten `first_name_ciphertext`, `last_name_ciphertext`, `phone_ciphertext`, `position`, `department`, `avatar_url`, `preferred_language`, `timezone`, `status`, `notes` hinzugefügt
- **UND** PII-Felder verwenden das bestehende `*_ciphertext`-Muster (ADR-010)
- **UND** die bestehenden Spalten (`keycloak_subject`, `email_ciphertext`, `display_name_ciphertext`, `instance_id`) bleiben unverändert

#### Scenario: Temporale Rollen-Zuweisungen

- **WENN** die Delta-Migration ausgeführt wird
- **DANN** erhält `iam.account_roles` die Spalten `assigned_by`, `valid_from`, `valid_to`

#### Scenario: Activity-Log-Erweiterungen (Compliance)

- **WENN** ein IAM-relevantes Ereignis auftritt
- **DANN** wird ein unveränderlicher Eintrag in `iam.activity_logs` geschrieben
- **UND** der Eintrag enthält `event_type` (aus der definierten Taxonomie), `account_id` (Akteur), `subject_id` (Betroffener), `payload` (JSONB), `result` ('success'|'failure'), `request_id` und `trace_id`
- **UND** ein Immutabilitäts-Trigger verhindert `UPDATE` und `DELETE` auf `iam.activity_logs`

#### Scenario: Audit-Log-Retention

- **WENN** ein Audit-Log-Eintrag älter als 365 Tage ist
- **DANN** wird er archiviert (nicht gelöscht)
- **UND** die Aufbewahrungsfrist ist mandantenspezifisch konfigurierbar via `iam.instances.audit_retention_days` (Standard: 365 Tage)
- **UND** die DSGVO-Anonymisierung für Account-PII wird separat über `iam.instances.retention_days` gesteuert (Standard: 90 Tage)
- **UND** die Tabelle ist nach `created_at` partitioniert (monatlich) für effiziente Archivierung – wird als separater Follow-up-Change umgesetzt

### Requirement: Keycloak Admin API Integration

Das System MUST über einen dedizierten Service-Account mit der Keycloak Admin REST API kommunizieren, um Benutzer-Accounts und Rollen-Zuweisungen synchron zu halten. Die Kommunikation erfolgt über eine `IdentityProviderPort`-Abstraktionsschicht.

#### Scenario: Service-Account-Authentifizierung

- **WENN** der IAM-Service startet
- **DANN** authentifiziert er sich bei Keycloak mit dem Service-Account `sva-studio-iam-service`
- **UND** der Service-Account hat nur die Rollen `manage-users`, `view-users`, `view-realm` und `manage-realm` (Principle of Least Privilege für Benutzer- und Realm-Role-Verwaltung)
- **UND** das Client-Secret wird über einen Secrets-Manager injiziert (nicht als `.env`-Datei)
- **UND** das Secret wird alle 90 Tage rotiert (BSI-Grundschutz ORP.4) mit Dual-Secret-Rotation (Overlap-Fenster)

#### Scenario: User-Erstellung (Keycloak-First mit Compensation)

- **WENN** ein Administrator einen User über den IAM-Service erstellt
- **DANN** wird der User zuerst in Keycloak via `POST /admin/realms/{realm}/users` erstellt
- **UND** anschließend in `iam.accounts` mit dem von Keycloak vergebenen `keycloak_subject` gespeichert
- **UND** fehlende `iam.instance_memberships` werden für den aktiven Instanzkontext angelegt
- **UND** Rollen werden erst nach erfolgreicher Persistenz mit Keycloak synchronisiert
- **UND** der `instance_id`-Scope wird korrekt gesetzt
- **WENN** der Keycloak-Call fehlschlägt
- **DANN** wird kein Eintrag in `iam.accounts` erstellt
- **WENN** der DB-Write fehlschlägt (nach erfolgreichem Keycloak-Call)
- **DANN** wird der Keycloak-User via `DELETE` entfernt (Compensation)
- **UND** ein `keycloak.sync_failed`-Audit-Event wird geloggt

#### Scenario: Benutzer aus Keycloak nach IAM importieren

- **WENN** ein Administrator einen Keycloak-Sync für eine Instanz ausführt
- **DANN** werden nur Keycloak-Benutzer mit passendem `instanceId`-Attribut importiert oder aktualisiert
- **UND** Basisdaten wie Benutzername, E-Mail, Vorname, Nachname, Anzeigename und Aktivstatus werden in `iam.accounts` gespiegelt
- **UND** fehlende `iam.instance_memberships` werden angelegt
- **UND** bestehende IAM-Benutzer werden nicht dupliziert

#### Scenario: Profil-Update-Sync (mit Compensation)

- **WENN** ein Benutzerprofil im IAM-Service geändert wird
- **DANN** werden die geänderten Felder zuerst an Keycloak via `PUT /admin/realms/{realm}/users/{id}` gesendet
- **UND** anschließend die entschlüsselten PII-Daten in den `*_ciphertext`-Spalten in `iam.accounts` aktualisiert
- **WENN** der DB-Write fehlschlägt (nach erfolgreichem Keycloak-Update)
- **DANN** wird Keycloak mit den vorherigen Werten zurückgesetzt (Compensation)

#### Scenario: JIT-Provisioning beim Erst-Login

- **WENN** ein Benutzer sich erstmalig per OIDC anmeldet und kein `iam.accounts`-Eintrag existiert
- **DANN** wird ein Account via `INSERT ... ON CONFLICT (keycloak_subject, instance_id) DO UPDATE SET updated_at = NOW()` erstellt (nur nicht-administrative Felder updaten, keine Rollen/Status überschreiben)
- **UND** ein `user.jit_provisioned`-Audit-Event wird geloggt

#### Scenario: Circuit-Breaker bei Keycloak-Ausfällen

- **WENN** Keycloak nicht erreichbar ist (5 aufeinanderfolgende Fehler)
- **DANN** wechselt der Circuit-Breaker in den Open-State (30 Sekunden)
- **UND** Read-Operationen fallen auf die IAM-DB als Fallback zurück
- **UND** Write-Operationen geben `503 Service Unavailable` zurück
- **UND** der Health-Check `/health/ready` meldet Keycloak als `degraded`

### Requirement: Idempotency für duplikatskritische IAM-Endpunkte

Das System MUST Idempotency für duplikatskritische Mutationen erzwingen, um doppelte Keycloak- und Datenbankoperationen bei Retries zu verhindern.

#### Scenario: Erstanfrage mit Idempotency-Key

- **WENN** ein Client `POST /api/v1/iam/users`, `POST /api/v1/iam/users/bulk-deactivate` oder `POST /api/v1/iam/roles` mit `X-Idempotency-Key` aufruft
- **DANN** wird die Operation genau einmal ausgeführt und das Ergebnis serverseitig gespeichert
- **UND** der Key wird im Scope (`actor_account_id`, `endpoint`, `idempotency_key`) ausgewertet

#### Scenario: Retry mit identischem Payload

- **WENN** ein Client denselben Endpunkt mit demselben `X-Idempotency-Key` und identischem Payload erneut aufruft
- **DANN** liefert der Server das gespeicherte Ergebnis zurück
- **UND** es erfolgt keine zweite mutierende Operation gegen Keycloak oder IAM-DB

#### Scenario: Wiederverwendung mit abweichendem Payload

- **WENN** ein Client denselben `X-Idempotency-Key` für denselben Endpunkt mit abweichendem Payload wiederverwendet
- **DANN** antwortet der Server mit `409 Conflict`
- **UND** der Fehlercode ist `IDEMPOTENCY_KEY_REUSE`

### Requirement: Serverseitige Autorisierung, CSRF-Schutz und Eingabevalidierung

Das System MUST alle IAM-API-Endpunkte serverseitig gegen unberechtigte Zugriffe, CSRF-Angriffe und ungültige Eingaben absichern.

#### Scenario: Frontend-Guard wird umgangen

- **WENN** ein Client ohne ausreichende Rolle direkt `POST /api/v1/iam/users` oder `PATCH /api/v1/iam/users/:id` aufruft
- **DANN** lehnt der Server die Anfrage mit `403 Forbidden` ab
- **UND** die Ablehnung wird als `auth.unauthorized_access`-Event im Audit-Log protokolliert
- **UND** der `request_id`-Correlation-Header wird in den Log-Eintrag übernommen

#### Scenario: Privilege-Escalation-Schutz

- **WENN** ein Benutzer versucht, einem anderen Benutzer eine Rolle zuzuweisen, die höher als seine eigene ist
- **DANN** lehnt der Server die Anfrage mit `403 Forbidden` ab
- **WENN** ein Benutzer versucht, die `system_admin`-Rolle zuzuweisen
- **DANN** ist dies nur erlaubt, wenn der anfragende Benutzer selbst `system_admin` ist
- **WENN** versucht wird, den letzten aktiven `system_admin` zu entfernen
- **DANN** lehnt der Server die Anfrage ab (Last-Admin-Schutz)

#### Scenario: CSRF-Schutz für mutierende Endpunkte

- **WENN** ein Client einen mutierenden IAM-Endpunkt aufruft (`POST`, `PATCH`, `DELETE`)
- **DANN** MUST der Session-Cookie `SameSite=Lax` gesetzt sein
- **UND** der Request MUST einen `X-Requested-With: XMLHttpRequest`-Header enthalten
- **UND** Anfragen ohne gültigen `X-Requested-With`-Header werden mit `403 Forbidden` abgelehnt
- **UND** `SameSite=Lax` (statt `Strict`) ermöglicht die Session-Beibehaltung nach Keycloak-Redirect

#### Scenario: Rate Limiting

- **WENN** ein Client die Ratenbegrenzung überschreitet
- **DANN** antwortet der Server mit `429 Too Many Requests`
- **UND** die Limits sind: 60 req/min für Read, 10 req/min für Write, 3 req/min für Bulk-Operationen (pro User-ID, authentifiziert; Fallback auf IP für nicht-authentifizierte Requests)

#### Scenario: Ungültige Payload bei mutierenden Endpunkten

- **WENN** ein Client für IAM-Mutationsendpunkte ungültige oder unerlaubte Felder sendet
- **DANN** validiert der Server die Nutzlast gegen ein Zod-Schema
- **UND** antwortet bei Verstößen mit `400 Bad Request` (Code: `VALIDATION_ERROR`)
- **UND** es werden keine teilweisen Datenänderungen in IAM-DB oder Keycloak geschrieben

#### Scenario: Operatives Logging ohne Klartext-PII

- **WENN** IAM-Endpunkte Fehler oder Warnungen loggen
- **DANN** erfolgt das Logging ausschließlich über den SDK Logger (`@sva/sdk`) mit Component-Label
- **UND** es werden keine Klartext-PII, Tokens oder Session-IDs in operativen Logs ausgegeben
- **UND** E-Mail-Adressen werden maskiert (`u***@example.com`) falls in Fehlermeldungen nötig

### Requirement: Health-Checks und Observability

Das System MUST Health-Check-Endpunkte bereitstellen, die den Zustand der IAM-Infrastruktur prüfen.

#### Scenario: Readiness-Probe

- **WENN** ein Orchestrator (K8s, Docker) die Readiness prüft via `GET /health/ready`
- **DANN** prüft der Endpunkt: DB-Connection, Keycloak-Konnektivität, Redis-Session-Store
- **UND** gibt `200 OK` zurück, wenn alle Systeme erreichbar sind
- **UND** gibt `503 Service Unavailable` mit Details zurück, wenn ein System ausgefallen ist

#### Scenario: Liveness-Probe

- **WENN** ein Orchestrator `GET /health/live` aufruft
- **DANN** gibt der Endpunkt `200 OK` zurück, solange der Prozess nicht hängt

### Requirement: Correlation-IDs und Tracing

Alle IAM-Requests MUST durchgängig nachverfolgbar sein.

#### Scenario: Request-Korrelation

- **WENN** ein IAM-API-Request eingeht
- **DANN** erhält er eine `request_id` (UUID), die in allen operativen Logs, Audit-Logs und Keycloak-API-Calls mitgeführt wird
- **UND** der OTEL Trace-Context (`W3C traceparent`) wird an Downstream-Services propagiert

### Requirement: PII-Feldklassifikation

Alle IAM-Datenfelder MUST nach PII-Stufe klassifiziert und entsprechend behandelt werden.

#### Scenario: PII-Schutz in der Datenhaltung

- **WENN** personenbezogene Daten gespeichert werden
- **DANN** werden `email`, `display_name`, `first_name`, `last_name`, `phone` als `*_ciphertext` verschlüsselt (ADR-010)
- **UND** Service-Account-Tokens werden niemals persistiert oder geloggt
- **UND** `account_id` (UUID) dient als Pseudonym in Logs und Audit-Events

### Requirement: Studio-Rollen-Lebenszyklus mit Keycloak-Synchronisierung

Das System MUST Rollen-CRUD aus dem Studio mit Keycloak Realm Roles synchronisieren, sodass für studioverwaltete Rollen keine manuelle Keycloak-Pflege erforderlich ist.

#### Scenario: Custom-Rolle erstellen

- **WHEN** ein `system_admin` eine neue Custom-Rolle im Studio erstellt
- **THEN** wird die Rolle in Keycloak als Realm Role angelegt
- **AND** danach wird die Rolle in `iam.roles` persistiert
- **AND** die API-Antwort enthält `syncState = "synced"`

#### Scenario: Custom-Rolle aktualisieren

- **WHEN** ein `system_admin` eine bestehende Custom-Rolle aktualisiert
- **THEN** werden die relevanten Metadaten in Keycloak und IAM-Datenbank konsistent aktualisiert
- **AND** die Antwort enthält den finalen Synchronisierungsstatus

#### Scenario: Custom-Rolle löschen

- **WHEN** ein `system_admin` eine löschbare Custom-Rolle entfernt
- **THEN** werden abhängige Rollenzuweisungen gemäß bestehender Schutzregeln verarbeitet
- **AND** die zugehörige Keycloak-Rolle wird entfernt
- **AND** das Mapping wird aus dem IAM-Speicher gelöscht

### Requirement: Deterministisches Role-Mapping und Sync-Status

Das System SHALL pro studioverwalteter Rolle ein eindeutiges externes Mapping und einen nachvollziehbaren Synchronisierungsstatus führen.

#### Scenario: Mapping bei erfolgreicher Synchronisierung

- **WHEN** eine Rolle erfolgreich nach Keycloak synchronisiert wird
- **THEN** speichert das System das Mapping zwischen interner Rolle und externer Keycloak-Rolle
- **AND** aktualisiert `lastSyncedAt` auf den erfolgreichen Zeitstempel
- **AND** setzt `syncState` auf `synced`

#### Scenario: Keycloak-Fehler bei Rollenoperation

- **WHEN** eine Keycloak-Operation für eine Rolle fehlschlägt
- **THEN** bleibt kein inkonsistenter Teilerfolg ohne Kennzeichnung zurück
- **AND** `syncState` wird auf `failed` gesetzt
- **AND** ein maschinenlesbarer Fehlercode wird gespeichert

#### Scenario: Keycloak ist nicht erreichbar

- **WHEN** Keycloak für Rollen-CRUD nicht erreichbar ist (Timeout/5xx)
- **THEN** antwortet die API deterministisch mit Fehler (`503` + Fehlercode `IDP_UNAVAILABLE`)
- **AND** es bleibt kein unmarkierter Teilerfolg bestehen
- **AND** `syncState` wird auf `failed` gesetzt

### Requirement: Reconciliation für Rollen-Drift

Das System MUST eine Reconciliation-Funktion bereitstellen, die Drift zwischen IAM-Rollenbestand und Keycloak-Rollenbestand erkennt und im Managed-Scope behebt.

#### Scenario: Fehlende Keycloak-Rolle wird erkannt

- **WHEN** eine studioverwaltete Rolle in der IAM-Datenbank existiert, aber in Keycloak fehlt
- **THEN** markiert der Reconcile-Lauf den Zustand als Drift
- **AND** erstellt die fehlende Keycloak-Rolle neu
- **AND** protokolliert das Ergebnis als Audit-Ereignis

#### Scenario: Manuelle Reconcile-Ausführung

- **WHEN** ein `system_admin` `POST /api/v1/iam/admin/reconcile` ausführt
- **THEN** liefert das System einen strukturierten Bericht mit Anzahl geprüfter, korrigierter und fehlgeschlagener Rollen
- **AND** unbehebbare Abweichungen werden mit klarer Fehlerursache zurückgegeben

#### Scenario: Unberechtigter Reconcile-Aufruf

- **WHEN** ein Nutzer ohne `system_admin` `POST /api/v1/iam/admin/reconcile` ausführt
- **THEN** antwortet das System mit `403 Forbidden`
- **AND** es erfolgt keine Reconcile-Ausführung

#### Scenario: Orphaned, studio-verwaltete Keycloak-Rolle

- **WHEN** eine studio-verwaltete Keycloak-Rolle ohne korrespondierende IAM-Rolle erkannt wird
- **THEN** markiert der Reconcile-Lauf die Abweichung als `requires_manual_action`
- **AND** die Rolle wird im Standardmodus nicht automatisch gelöscht

### Requirement: Auditierbares und datensparsames Logging

Das System MUST für Role-Sync und Reconciliation strukturierte Logs und Audit-Events mit Korrelation bereitstellen, ohne sensible Daten zu persistieren.

#### Scenario: Korrelation in Sync-/Reconcile-Ereignissen

- **WHEN** ein Role-Sync oder Reconcile ausgeführt wird
- **THEN** enthalten Logs/Audit-Events mindestens `request_id` sowie, falls vorhanden, `trace_id` und `span_id`
- **AND** das Event-Schema enthält `operation`, `result` und optional `error_code`

#### Scenario: Fehlerdaten sind datensparsam

- **WHEN** eine Sync-/Reconcile-Operation fehlschlägt
- **THEN** werden keine Tokens, Secrets oder personenbezogenen Rohdaten in Logs/Auditdaten gespeichert
- **AND** Fehler werden über maschinenlesbare Codes statt sensibler Rohdaten abgebildet

### Requirement: Per-User-Delegation an den SVA-Mainserver

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig und per Benutzer delegieren. API-Key und Secret werden aus Keycloak-User-Attributen des aktuellen Benutzers gelesen und nicht im Browser, in Sessions oder in der Studio-Datenbank gespiegelt.

#### Scenario: Serverseitiger Mainserver-Aufruf mit aktuellen Keycloak-Attributen

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf für einen authentifizierten Benutzer ausführt
- **THEN** liest das System bevorzugt `mainserverUserApplicationId` und `mainserverUserApplicationSecret` aus den Keycloak-User-Attributen dieses Benutzers
- **AND** fordert serverseitig ein OAuth2-Access-Token an
- **AND** sendet den GraphQL-Aufruf mit `Authorization: Bearer <token>` an den SVA-Mainserver
- **AND** exponiert weder Credentials noch Access-Token an Browser-Code

#### Scenario: Legacy-Attribute bleiben übergangsweise lauffähig

- **WHEN** die aktuellen Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret` für einen Benutzer nicht gesetzt sind
- **AND** die Legacy-Attribute `sva_mainserver_api_key` und `sva_mainserver_api_secret` vorhanden sind
- **THEN** verwendet das System die Legacy-Attribute als Fallback
- **AND** der Mainserver-Aufruf bleibt für Bestandsbenutzer funktionsfähig

#### Scenario: Fehlende Mainserver-Credentials im Benutzerprofil

- **WHEN** für den aktuellen Benutzer weder die aktuellen noch die Legacy-Attribute vollständig in Keycloak vorhanden sind
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

### Requirement: Keycloak-Sync Debug-Logging

Das System SHALL beim Keycloak-User-Sync detaillierte Debug-Informationen für übersprungene Benutzer bereitstellen, um Multi-Tenant-Konfigurationsprobleme schnell diagnostizierbar zu machen.

#### Scenario: Einzeln übersprungene User geloggt

- **WHEN** ein Keycloak-User beim Sync übersprungen wird (kein passender Instanzkontext)
- **AND** der Debug-Log-Level aktiv ist (`logger.isLevelEnabled('debug')` als Guard)
- **THEN** erzeugt das System begrenzte oder gesampelte `debug`-Log-Einträge mit `subject_ref` (pseudonymisiert), `user_instance_id` und `expected_instance_id`

#### Scenario: Detail-Logs sind begrenzt

- **WHEN** in einem Sync-Lauf sehr viele User übersprungen werden
- **THEN** werden Detail-Logs pro Request begrenzt oder gesampelt
- **AND** die Gesamtsituation bleibt über ein Summary-Log nachvollziehbar

#### Scenario: Keine Debug-Logs bei inaktivem Level

- **WHEN** ein Keycloak-User beim Sync übersprungen wird
- **AND** der Debug-Log-Level nicht aktiv ist
- **THEN** werden keine `debug`-Log-Einträge erzeugt und keine Log-Objekte konstruiert (Performance-Schutz)

#### Scenario: Zusammenfassung der übersprungenen User

- **WHEN** der Keycloak-Sync abgeschlossen ist und User übersprungen wurden
- **THEN** erzeugt das System einen `info`-Log-Eintrag mit `skipped_count` und `sample_instance_ids` (kommaseparierter String der gefundenen instanceId-Werte, max. 5 verschiedene)
- **AND** der Eintrag enthält `request_id` und `trace_id` via `buildLogContext({ includeTraceId: true })`

#### Scenario: Keine Zusammenfassung bei null Übersprungenen

- **WHEN** der Keycloak-Sync abgeschlossen ist und keine User übersprungen wurden
- **THEN** wird kein `debug`-Log und kein `info`-Summary-Log für übersprungene User erzeugt

### Requirement: Client-seitige Fehlerberichtung

Das System SHALL client-seitige API-Fehler nur im Development-Modus strukturiert in der Browser-Konsole protokollieren, um Korrelation zwischen Client- und Server-Fehlern zu ermöglichen, ohne Produktions-Logs im Browser zu erzeugen.

#### Scenario: Fehler-Log bei API-Fehler

- **WHEN** `requestJson` im Development-Modus eine nicht-erfolgreiche API-Response erhält (HTTP 4xx/5xx mit JSON-Body)
- **THEN** erzeugt das System einen `console.error`-Eintrag mit `request_id`, `status` und `code`
- **AND** der Eintrag enthält **keinen** Response-Body, Request-Payload oder PII

#### Scenario: Kein Browser-Logging in Produktion

- **WHEN** `requestJson` in einem Produktions-Build einen API-Fehler verarbeitet
- **THEN** erzeugt das System keinen `console.error`-Eintrag
- **AND** die Korrelation erfolgt über Server-Logs und den `X-Request-Id`-Response-Header

#### Scenario: Korrelation bei Non-JSON-Response

- **WHEN** `requestJson` eine nicht-JSON-Response erhält (z. B. HTML-Fehlerseite)
- **THEN** wird `request_id` aus dem `X-Request-Id`-Response-Header extrahiert (Fallback)
- **AND** der `console.error`-Eintrag enthält `request_id` (oder `undefined` wenn Header fehlt), `status` und `code: 'non_json_response'`

#### Scenario: Kein Body-Logging

- **WHEN** `requestJson` einen Fehler loggt
- **THEN** werden weder Request-Body noch Response-Body im Log-Eintrag enthalten
- **AND** es werden keine Klartext-Tokens, Session-IDs oder E-Mail-Adressen geloggt

### Requirement: Rückwärtskompatibler IAM-v1-Fehlervertrag

Das System MUST für bereits dokumentierte stabile IAM-v1-Endpunkte den öffentlichen Fehlervertrag rückwärtskompatibel halten.

#### Scenario: Maschinenlesbarer Fehlercode bleibt stabil

- **WHEN** ein stabiler IAM-v1-Endpunkt eine Fehlerantwort liefert
- **THEN** bleibt das Feld `error` ein String-Code
- **AND** bestehende Konsumenten müssen ihre Parser nicht auf ein Objekt unter `error` umstellen

#### Scenario: Öffentliche Diagnoseinformation bleibt additiv

- **WHEN** zusätzlich ein Feld `message` in einer IAM-v1-Fehlerantwort vorhanden ist
- **THEN** ist dieses Feld additiv und optional
- **AND** es ist nicht für Client-Logik bestimmt
- **AND** es enthält keine rohen Exception-Texte, Stack-Fragmente oder Provider-Interna

#### Scenario: Request-ID-Header ist für Support-Korrelation verfügbar

- **WHEN** ein stabiler IAM-v1-Endpunkt eine Response erzeugt, auch bei Fehlern oder Non-JSON-Fallbacks
- **THEN** enthält die Response best-effort den Header `X-Request-Id`
- **AND** Clients und Support-Tools können damit Browser-, Netzwerk- und Server-Sicht korrelieren

### Requirement: Automatisierter Basis-IAM-Abnahmenachweis

Das System MUST für den Basis-IAM-Umfang einen reproduzierbaren Abnahmenachweis in der vereinbarten Testumgebung bereitstellen.

#### Scenario: Readiness-Gate bestätigt alle Basisabhängigkeiten

- **WHEN** der Abnahme-Flow für Paket 1 ausgeführt wird
- **THEN** bestätigt das Readiness-Gate die Betriebsbereitschaft von Keycloak, Datenbank und Redis
- **AND** ein fehlender Bestandteil blockiert die Abnahme deterministisch mit einem dokumentierten Fehlerbild

#### Scenario: OIDC-Smoke prüft Login und Claims-Vertrag

- **WHEN** der Paket-1-Abnahmeflow einen Test-Login ausführt
- **THEN** wird ein erfolgreicher OIDC-Login gegen den dedizierten Test-Realm nachgewiesen
- **AND** der resultierende Benutzerkontext enthält mindestens `sub`, `instanceId` und die erwarteten Rollen-Claims
- **AND** das Ergebnis wird als versionierter Abnahmebericht dokumentiert

### Requirement: Abgesicherte Login-zu-Account-Synchronisierung

Das System MUST im Abnahmepfad nachweisen, dass ein erfolgreicher Login deterministisch zum passenden IAM-Account-Kontext führt.

#### Scenario: Erst-Login erzeugt oder verknüpft IAM-Account

- **WHEN** ein Test-Benutzer sich in der Paket-1-/2-Testumgebung erstmals anmeldet
- **THEN** wird ein passender `iam.accounts`-Datensatz erzeugt oder wiederverwendet
- **AND** die Verknüpfung zur Keycloak-Identity ist nachweisbar korrekt

#### Scenario: Wiederholter Login bleibt idempotent

- **WHEN** derselbe Test-Benutzer den Login erneut durchläuft
- **THEN** entstehen keine doppelten Account-Datensätze
- **AND** der bestehende Account-Kontext bleibt stabil

### Requirement: Nicht-sensitive Diagnosefelder für IAM-Hotspots

Das System MUST für stabile IAM-v1-Hotspots strukturierte, nicht-sensitive Diagnosefelder bereitstellen, damit fachliche Ursachen ohne Provider- oder Secret-Leakage erkennbar werden.

#### Scenario: Fehlender Actor-Account wird explizit diagnostiziert

- **WHEN** ein IAM-Endpunkt wie `/api/v1/iam/me/context` oder `/api/v1/iam/users` den Actor im aktiven Instanzkontext nicht auflösen kann
- **THEN** bleibt der öffentliche Fehlercode stabil (`forbidden` oder `database_unavailable`)
- **AND** die Antwort enthält additive `details.reason_code`-Werte wie `missing_actor_account` oder `missing_instance_membership`
- **AND** die Antwort enthält keine rohen SQL-, Token- oder Provider-Interna

#### Scenario: Schema-Drift wird deterministisch gemeldet

- **WHEN** ein kritischer IAM-Schema-Bestandteil wie `iam.account_groups`, `iam.groups`, `idx_accounts_kc_subject_instance` oder eine RLS-Policy fehlt
- **THEN** melden `/health/ready`, `env:doctor:*` und betroffene IAM-Hotspots eine maschinenlesbare Ursache wie `schema_drift`, `missing_table` oder `missing_column`
- **AND** optionale Hinweise wie `schema_object` und `expected_migration` bleiben nicht-sensitiv

### Requirement: Kritischer IAM-Schema-Guard

Das System MUST vor Acceptance-Smoke und nach Migrationen den kritischen IAM-Sollstand validieren.

#### Scenario: Migration validiert den Sollstand

- **WHEN** `env:migrate:acceptance-hb` erfolgreich alle SQL-Dateien angewendet hat
- **THEN** validiert ein Schema-Guard kritische Tabellen, Spalten, Indizes und RLS-Policies
- **AND** der Befehl endet nicht erfolgreich, solange kritische Drift verbleibt

#### Scenario: Smoke erkennt Drift vor Fachfehlern

- **WHEN** `env:smoke:<profil>` oder `env:doctor:<profil>` gegen einen Drift-Zustand ausgeführt wird
- **THEN** wird die Drift als eigener Fehler gemeldet
- **AND** die Betriebsanalyse muss nicht erst über zufällige `500`- oder `403`-Antworten auf indirekten Fachpfaden erfolgen

### Requirement: Profil-Sync getrennt vom Session-Kern
Das System SHALL Profilattribute wie Name und E-Mail getrennt vom Session- und Autorisierungskern verarbeiten.

#### Scenario: Profilanzeige ueber dedizierten Profilpfad

- **WHEN** die App Profildaten fuer Anzeige oder Bearbeitung benoetigt
- **THEN** laedt sie diese ueber dedizierte Profil-Endpunkte oder Sync-Flows
- **AND** die Session bleibt auf Auth-Kernfelder begrenzt
- **AND** Profil-PII wird nicht als Nebenprodukt des Login-Flows in operative Logs oder generische Session-Nutzlasten gezogen

#### Scenario: Synchronisation mit Keycloak bleibt moeglich

- **WHEN** Studio Name oder E-Mail mit Keycloak synchron halten muss
- **THEN** erfolgt dies ueber dedizierte Profil-/Sync-Operationen
- **AND** die verschluesselte Persistenz in `iam.accounts` bleibt erhalten
- **AND** die Synchronisation haengt nicht davon ab, dass Name oder E-Mail im Session-Kern enthalten sind

### Requirement: Erzwungener Re-Login pro Benutzer
Das System SHALL einen deterministischen Forced-Reauth-Mechanismus pro Benutzer bereitstellen.

#### Scenario: App-only Forced Reauth

- **WHEN** das System `forceReauthUser({ userId, mode: 'app_only' })` ausführt
- **THEN** werden alle bekannten Studio-Sessions dieses Benutzers ungültig
- **AND** neue Requests mit alten Sessions schlagen fehl
- **AND** eine weiterhin aktive Keycloak-SSO-Session bleibt unberührt

#### Scenario: Forced Reauth inklusive IdP-Logout

- **WHEN** das System `forceReauthUser({ userId, mode: 'app_and_idp' })` ausführt
- **THEN** werden alle bekannten Studio-Sessions des Benutzers ungültig
- **AND** aktive Keycloak-User-Sessions werden zusätzlich per Admin-API beendet
- **AND** ein nachfolgender Login erfordert eine echte Re-Authentifizierung

### Requirement: Versionierte Session-Gültigkeit
Das System SHALL Session-Version und benutzerbezogene Reauth-Marker gemeinsam auswerten.

#### Scenario: Session-Version ist veraltet

- **WHEN** eine Session eine niedrigere `sessionVersion` als die aktuelle `minimumSessionVersion` des Benutzers trägt
- **THEN** behandelt das System die Session als ungültig
- **AND** `/auth/me` oder geschützte Requests liefern kein erfolgreiches Session-Ergebnis mehr

#### Scenario: Forced-Reauth-Zeitpunkt überholt Session

- **WHEN** `forcedReauthAt` nach der Ausstellung einer Session gesetzt wurde
- **THEN** wird die ältere Session bei der nächsten Auflösung verworfen
- **AND** ein Re-Login ist erforderlich

### Requirement: Persistentes fachliches Rechtstext-Modell

Das System SHALL Rechtstext-Versionen serverseitig als fachliche Inhalte mit UUID, Name, Versionsnummer, Sprache, HTML-Inhalt, Status sowie Erstellungs-, Änderungs- und Veröffentlichungsdatum persistieren.

#### Scenario: Rechtstext serverseitig erstellen

- **WHEN** ein berechtigter Administrator eine neue Rechtstext-Version anlegt
- **THEN** vergibt das System eine UUID automatisch
- **AND** speichert Name, Versionsnummer, Sprache, HTML-Inhalt, Status und Zeitstempel serverseitig

#### Scenario: Rechtstext serverseitig aktualisieren

- **WHEN** ein berechtigter Administrator eine bestehende Rechtstext-Version bearbeitet
- **THEN** persistiert das System die geänderten Fachfelder serverseitig
- **AND** aktualisiert das Änderungsdatum

#### Scenario: Statusmodell wird fachlich validiert

- **WHEN** eine Rechtstext-Version erstellt oder aktualisiert wird
- **THEN** akzeptiert das System nur die Statuswerte `draft`, `valid` oder `archived`
- **AND** lehnt ungültige Statuswerte mit einem Validierungsfehler ab

#### Scenario: Gültige Rechtstexte verlangen Veröffentlichungsdatum

- **WHEN** eine Rechtstext-Version mit Status `valid` gespeichert wird
- **THEN** verlangt das System ein Veröffentlichungsdatum
- **AND** speichert den Datensatz nicht ohne diese Angabe

