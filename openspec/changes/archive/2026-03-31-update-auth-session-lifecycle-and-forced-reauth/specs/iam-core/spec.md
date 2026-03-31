## MODIFIED Requirements

### Requirement: Session Management
Das System MUST Benutzersitzungen sicher verwalten, einschließlich serverseitiger Token-Erneuerung, einer fachlich führenden Session-Gültigkeit und kontrollierter Wiederherstellung nach Session-Ablauf.

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

#### Scenario: AuthProvider-Recovery nach 401

- **WHEN** `AuthProvider` auf `/auth/me` oder einem geschützten Auth-Read ein `401` erhält
- **THEN** startet das Frontend genau einen stillen Reauth-Versuch
- **AND** bei Erfolg wird `/auth/me` erneut geladen
- **AND** bei Misserfolg bleibt `useAuth()` bei `{ user: null, isAuthenticated: false }`

#### Scenario: Logout unterdrückt Silent SSO

- **WHEN** ein Benutzer sich explizit abmeldet
- **THEN** invalidiert das System die aktuelle Session und setzt eine zeitlich begrenzte Silent-SSO-Sperre
- **AND** ein automatischer Silent-Reauth-Versuch darf unmittelbar danach nicht erfolgen

## ADDED Requirements

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
