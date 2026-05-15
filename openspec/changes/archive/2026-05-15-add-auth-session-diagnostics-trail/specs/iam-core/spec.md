## MODIFIED Requirements

### Requirement: Session Management

Das System MUST Benutzersitzungen sicher verwalten, einschließlich serverseitiger Token-Erneuerung, einer fachlich führenden Session-Gültigkeit, Redis-basierter Persistenz aktiver App-Sessions, kontrollierter Wiederherstellung nach Session-Ablauf und strukturierter Diagnostik für Auth-Unterbrechungen.

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
- **AND** Browser und Server stellen für den Vorfall korrelierbare Diagnoseinformationen über `requestId`, `reason_code` und `authFlowId` bereit

### Requirement: Browser diagnostics use safe structured logging in development

Das System MUST für produktiven Browser-App-Code bevorzugt eine browser-taugliche Logger-API statt rohem `console.*` verwenden, wenn operative IAM-Diagnostik erzeugt wird.

#### Scenario: IAM browser api errors use the browser logger

- **WHEN** produktiver Browser-App-Code einen IAM-API-Fehler im Development diagnostisch protokolliert
- **THEN** nutzt dieser Code den Browser-Logger
- **AND** der Logeintrag enthält `request_id`, `status` und `code`
- **AND** nur explizit erlaubte sichere Diagnosedetails werden geloggt

#### Scenario: Development-only browser capture may still hook console

- **WHEN** die Browser-Development-Log-Capture globale Browser-Events oder Third-Party-Console-Ausgaben mitschneidet
- **THEN** darf dieser Infrastrukturpfad weiterhin `console.*` hooken
- **AND** die dabei gespeicherten Einträge nutzen dieselben Redaction-Regeln wie der Browser-Logger

#### Scenario: Auth-Recovery-Trail uses safe local diagnostics

- **WHEN** ein Auth-Recovery- oder Session-Expired-Vorfall im Browser auftritt
- **THEN** darf der Browser in Development- oder Diagnosemodi einen lokalen Ringpuffer mit den letzten Auth-Ereignissen führen
- **AND** jeder Eintrag enthält nur sichere Metadaten wie `authFlowId`, `requestId`, `reason_code`, `classification` und `recovery_step`
- **AND** der Ringpuffer enthält keine Tokens und keine PII
