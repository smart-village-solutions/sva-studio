## MODIFIED Requirements

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
