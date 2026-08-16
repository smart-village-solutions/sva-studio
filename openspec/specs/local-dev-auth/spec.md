# local-dev-auth Specification

## Purpose
TBD - created by archiving change add-local-dev-auth-bypass. Update Purpose after archive.
## Requirements
### Requirement: Expliziter lokaler Dev-Auth-Modus

Das System SHALL einen rein lokalen Dev-Auth-Modus bereitstellen, der nur bei expliziter Aktivierung genutzt wird und klar von produktivem OIDC-Betrieb getrennt bleibt.

#### Scenario: Aktivierung über lokale Env-Flags

- **WHEN** der Server mit `SVA_DEV_AUTH=true` oder dem Legacy-Alias `SVA_MOCK_AUTH=true` läuft
- **AND** das Frontend mit `VITE_SVA_DEV_AUTH=true` oder dem Legacy-Alias `VITE_MOCK_AUTH=true` gebaut wird
- **THEN** darf die Studio-Shell einen expliziten lokalen Dev-Login anbieten
- **AND** der Modus bleibt auf lokale Entwicklerpfade beschränkt

### Requirement: Explizite Dev-Login-Session

Das System SHALL den Dev-Auth-Benutzer nicht global und stillschweigend aktivieren, sondern erst nach einem expliziten lokalen Dev-Login. Die bloße Konfigurationsverfügbarkeit von Dev-Auth MUST von einer nachweislich aktiven Dev-Auth-Testsession unterschieden werden und SHALL keine Route, Navigation, Modulzuweisung oder UI-Aktion freigeben.

#### Scenario: Dev-Login aktiviert den synthetischen Benutzerkontext

- **WHEN** Dev-Auth verfügbar ist
- **AND** der Benutzer `POST /auth/dev-login` aufruft
- **THEN** setzt das System eine lokale Dev-Auth-Session
- **AND** `/auth/me` liefert danach einen synthetischen Benutzer mit Instanz-, Rollen-, Modul- und Permission-Kontext
- **AND** folgt dessen UI-Autorisierung dem ausdrücklich dokumentierten Dev-Auth-Testvertrag

#### Scenario: Dev-Auth ist verfügbar, aber nicht aktiv

- **WHEN** Dev-Auth in der Umgebung konfiguriert ist
- **AND** keine aktive Dev-Auth-Testsession nachgewiesen ist
- **THEN** erzeugt `isDevAuthAvailable` keine zusätzliche Route-, Navigations-, Modul- oder Action-Freigabe
- **AND** wird eine parallel bestehende normale Session ausschließlich nach ihrem eigenen Effective-Access-State ausgewertet

#### Scenario: Dev-Logout entfernt den synthetischen Benutzerkontext

- **WHEN** eine lokale Dev-Auth-Session aktiv ist
- **AND** der Benutzer `POST /auth/dev-logout` aufruft
- **THEN** entfernt das System die lokale Dev-Auth-Session
- **AND** invalidiert der Host den zugehörigen Effective-Access-State
- **AND** `/auth/me` liefert danach wieder einen unauthentifizierten Zustand

### Requirement: Sichtbare Kennzeichnung und klare Abgrenzung

Das System SHALL den lokalen Dev-Auth-Modus in der UI sichtbar kennzeichnen und darf ihn nicht als Ersatz für echte IAM- oder OIDC-Verifikation ausgeben.

#### Scenario: Sichtbare Shell-Kennzeichnung

- **WHEN** Dev-Auth im Browser verfügbar oder aktiv ist
- **THEN** zeigt die Shell eine sichtbare Kennzeichnung wie `Dev-Auth aktiv`
- **AND** eine explizite Aktion `Als Dev-User anmelden`

#### Scenario: Keine Gleichsetzung mit echtem OIDC

- **WHEN** Dev-Auth aktiv ist
- **THEN** werden Silent-SSO, Forced-Reauth, Realm-Auflösung und feingranulare Permission-Logik nicht als produktionsnahe Verifikation behauptet

