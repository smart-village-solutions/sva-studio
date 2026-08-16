## MODIFIED Requirements

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
