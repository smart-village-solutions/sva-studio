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

Das System MUST von Keycloak ausgestellte JWT-Tokens validieren und Identity-Claims für nachgelagerte Autorisierungsentscheidungen extrahieren.

#### Scenario: Token signature verification

- **WHEN** eine Anfrage mit einem JWT-Token eingeht
- **THEN** verifiziert das Backend die Signatur mit dem öffentlichen Schlüssel von Keycloak
- **AND** validiert die Claims (`iss`, `aud`, `exp`, `nbf`)
- **AND** wenn eine Validierung fehlschlägt, wird die Anfrage abgelehnt

#### Scenario: User context extraction

- **WHEN** ein Token gültig ist
- **THEN** extrahiert das System die Claims `sub` (Benutzer-ID), `email` und `name`
- **AND** lädt zusätzliche Benutzerdaten aus der CMS-Datenbank (Organisationen, Rollen)
- **AND** injiziert ein `UserContext`-Objekt in die Anfrage für nachgelagerte Handler

### Requirement: Session Management

Das System MUST Benutzersitzungen sicher verwalten, einschließlich automatischer Ablaufbehandlung und Token-Erneuerung.

#### Scenario: Session expiration

- **WHEN** das Access Token eines Benutzers abläuft
- **THEN** schlägt eine API-Anfrage mit HTTP 401 fehl
- **AND** das Frontend stößt eine Token-Erneuerung an
- **AND** das neue Access Token wird sicher gespeichert (HttpOnly-Cookie)

#### Scenario: Logout

- **WHEN** ein Benutzer auf "Logout" klickt
- **THEN** wird die Sitzung invalidiert (Cookies gelöscht, Tokens widerrufen)
- **AND** der Benutzer wird zum Keycloak-Logout-Endpunkt weitergeleitet
- **AND** anschließend zurück zur öffentlichen CMS-Startseite

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

Das System MUST den SDK Logger (`createSdkLogger` aus `@sva/sdk`) für alle operativen Logs in IAM-Servermodulen verwenden, gemäß ADR-006 und Observability Best Practices. `console.log`/`console.error` DÜRFEN im IAM-Servercode NICHT verwendet werden.

#### Scenario: Structured logging with mandatory fields

- **WHEN** ein IAM-Servermodul einen Log-Eintrag erzeugt
- **THEN** enthält der Eintrag mindestens: `workspace_id` (= `instanceId`), `component` (z. B. `iam-auth`), `environment`, `level`
- **AND** PII-Redaktion wird automatisch durch den SDK Logger angewendet
- **AND** es erscheinen keine Klartext-Tokens, Session-IDs oder E-Mail-Adressen in Logs

#### Scenario: Correlation IDs in authentication flows

- **WHEN** ein IAM-API-Endpunkt aufgerufen wird
- **THEN** wird eine `request_id` erzeugt oder aus dem `X-Request-Id`-Header übernommen
- **AND** der OTEL-Trace-Kontext wird propagiert
- **AND** alle Log-Einträge innerhalb der Anfrage referenzieren `request_id` und `trace_id`

#### Scenario: Token validation error logging

- **WHEN** eine Token-Validierung fehlschlägt (invalid, expired, audience mismatch, issuer mismatch)
- **THEN** emittiert der SDK Logger einen `warn`-Eintrag mit `operation`, `error_type`, `has_refresh_token`, `request_id`
- **AND** es werden keine Tokenwerte oder Session-IDs im Log-Eintrag enthalten

---

