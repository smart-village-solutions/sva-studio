# IAM Core Spezifikation – Delta für Account-UI

## MODIFIED Requirements

### Requirement: Session Management

Das System MUST Benutzersitzungen sicher verwalten, einschließlich automatischer Ablaufbehandlung und Token-Erneuerung.

#### Scenario: Session expiration

- **WHEN** das Access Token eines Benutzers abläuft
- **THEN** schlägt eine API-Anfrage mit HTTP 401 fehl
- **AND** das Frontend stößt eine Token-Erneuerung an
- **AND** das neue Access Token wird sicher gespeichert (HttpOnly-Cookie)

#### Scenario: Logout

- **WHEN** ein Benutzer auf „Logout“ klickt
- **THEN** wird die Sitzung invalidiert (Cookies gelöscht, Tokens widerrufen)
- **AND** der Benutzer wird zum Keycloak-Logout-Endpunkt weitergeleitet
- **AND** anschließend zurück zur öffentlichen CMS-Startseite

#### Scenario: Session-Ablauf (Frontend-Weiterleitung)

- **WENN** die Sitzung eines Benutzers abläuft
- **DANN** leitet das System zur Login-Seite weiter
- **UND** das abgelaufene Session-Cookie wird gelöscht

#### Scenario: AuthProvider-Integration mit Session

- **WENN** die `AuthProvider`-Komponente (in `sva-studio-react`) gemountet wird
- **DANN** ruft sie `/auth/me` auf, um die aktuelle Sitzung aufzulösen
- **UND** bei gültiger Sitzung werden die User-Daten über den `useAuth()`-Context bereitgestellt
- **UND** bei ungültiger oder abgelaufener Sitzung gibt `useAuth()` `{ user: null, isAuthenticated: false }` zurück

#### Scenario: Logout über AuthProvider

- **WENN** ein Benutzer `logout()` aus dem `useAuth()`-Hook aufruft
- **DANN** ruft das System `POST /auth/logout` auf
- **UND** der AuthProvider-State wird auf `{ user: null, isAuthenticated: false }` zurückgesetzt
- **UND** der Benutzer wird auf die Post-Logout-Seite weitergeleitet

#### Scenario: Cache-Invalidierung bei Rollen-Änderungen

- **WENN** ein Administrator Rollen eines Benutzers ändert (Zuweisung oder Entfernung)
- **DANN** wird `invalidatePermissions()` aufgerufen
- **UND** der `PermissionSnapshotCache` wird neu berechnet
- **UND** `/auth/me` wird refetcht, um den aktuellen Auth-State zu aktualisieren

## ADDED Requirements

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
- **UND** die Aufbewahrungsfrist ist mandantenspezifisch konfigurierbar via `iam.instances.retention_days` (Standard: 365 Tage)
- **UND** die Tabelle ist nach `created_at` partitioniert (monatlich) für effiziente Archivierung – wird als separater Follow-up-Change umgesetzt

### Requirement: Keycloak Admin API Integration

Das System MUST über einen dedizierten Service-Account mit der Keycloak Admin REST API kommunizieren, um Benutzer-Accounts und Rollen-Zuweisungen synchron zu halten. Die Kommunikation erfolgt über eine `IdentityProviderPort`-Abstraktionsschicht.

#### Scenario: Service-Account-Authentifizierung

- **WENN** der IAM-Service startet
- **DANN** authentifiziert er sich bei Keycloak mit dem Service-Account `sva-studio-iam-service`
- **UND** der Service-Account hat nur die Rollen `manage-users`, `view-users`, `view-realm` (Principle of Least Privilege)
- **UND** das Client-Secret wird über einen Secrets-Manager injiziert (nicht als `.env`-Datei)
- **UND** das Secret wird alle 90 Tage rotiert (BSI-Grundschutz ORP.4) mit Dual-Secret-Rotation (Overlap-Fenster)

#### Scenario: User-Erstellung (Keycloak-First mit Compensation)

- **WENN** ein Administrator einen User über den IAM-Service erstellt
- **DANN** wird der User zuerst in Keycloak via `POST /admin/realms/{realm}/users` erstellt
- **UND** anschließend in `iam.accounts` mit dem von Keycloak vergebenen `keycloak_subject` gespeichert
- **UND** der `instance_id`-Scope wird korrekt gesetzt
- **WENN** der Keycloak-Call fehlschlägt
- **DANN** wird kein Eintrag in `iam.accounts` erstellt
- **WENN** der DB-Write fehlschlägt (nach erfolgreichem Keycloak-Call)
- **DANN** wird der Keycloak-User via `DELETE` entfernt (Compensation)
- **UND** ein `keycloak.sync_failed`-Audit-Event wird geloggt

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
