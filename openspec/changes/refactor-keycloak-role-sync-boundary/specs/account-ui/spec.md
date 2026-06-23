## ADDED Requirements
### Requirement: Rollenanzeigen nutzen eine kanonische Fachsicht
Das System SHALL in Profil-, Session- und Tenant-Admin-Ansichten eine kanonische Rollen- und Permission-Sicht verwenden, statt rohe Keycloak-Rollenlisten als primaere Benutzerdarstellung auszugeben.

#### Scenario: Account-Seite zeigt fachlich kanonische Rollen
- **WHEN** ein authentifizierter Tenant-Benutzer `/account` aufruft
- **THEN** zeigt die Seite die kanonischen tenantlokalen Rollen aus dem IAM-Modell an
- **AND** umfasst diese kanonische Sicht auch implizite Rollenwirkung aus Gruppenzuordnungen
- **AND** zeigt die Seite rohe Keycloak-Rollen in einer getrennten technischen Ansicht
- **AND** werden technische oder Legacy-Rollen nicht unkommentiert als normale Fachrollen dargestellt

#### Scenario: Admin-Ansicht unterscheidet kanonische Rollen von Rohrollen
- **WHEN** eine Benutzer- oder Rollenansicht Diagnosedaten zu Auth oder Sync einblendet
- **THEN** sind kanonische Tenant-Rollen und rohe Keycloak-Rollen klar getrennt beschriftet
- **AND** bleibt fuer Administratoren erkennbar, welche Sicht fuer Autorisierung normativ ist

## MODIFIED Requirements
### Requirement: Protected-Route-Guard
Das System MUST einen generischen Route-Guard bereitstellen, der Routen basierend auf Authentifizierungsstatus und der kanonischen tenantseitigen Rollen- oder Permission-Sicht schuetzt. Rohe Keycloak-Rollen duerfen nur dort direkt ausgewertet werden, wo eine ausdrueckliche technische Sonderrolle oder ein Plattform-Scope betroffen ist.

#### Scenario: Unauthentifizierter Zugriff auf geschützte Route
- **WHEN** ein nicht-authentifizierter Nutzer eine geschuetzte Route aufruft
- **THEN** wird der Nutzer zur Login-Seite weitergeleitet
- **AND** nach erfolgreicher Authentifizierung wird er zur urspruenglichen URL zurueckgeleitet

#### Scenario: Authentifizierter Nutzer ohne ausreichende fachliche Autorisierung
- **WHEN** ein authentifizierter Nutzer eine Route aufruft, fuer die eine bestimmte kanonische Rolle oder Permission erforderlich ist
- **AND** der Nutzer diese fachliche Freigabe im IAM-Modell nicht besitzt
- **THEN** wird der Nutzer auf die Startseite weitergeleitet
- **AND** eine verstaendliche Fehlermeldung wird angezeigt (`t('auth.insufficientRole')`)

#### Scenario: Admin-Route-Schutz folgt kanonischer Tenant-Sicht
- **WHEN** die Route `/admin/users` aufgerufen wird
- **THEN** prueft der Guard ueber den `routerContext`, ob der Nutzer die dafuer vorgesehene kanonische Tenant-Freigabe besitzt, etwa `system_admin` oder die entsprechende Verwaltungs-Permission
- **AND** verlaesst sich diese Entscheidung nicht auf rohe Legacy-Keycloak-Rollen wie `app_manager`

### Requirement: Account-Profilseite
Das System MUST eine Account-Profilseite unter `/account` bereitstellen, auf der authentifizierte Nutzer ihre eigenen Basis-Daten einsehen und bearbeiten koennen.

#### Scenario: Profil anzeigen
- **WHEN** ein authentifizierter Nutzer `/account` aufruft
- **THEN** werden Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache und Zeitzone angezeigt
- **AND** die kanonischen Rollen und der Account-Status sind sichtbar (read-only)
- **AND** eine getrennte technische Ansicht fuer rohe Keycloak-Rollen ist verfuegbar
- **AND** ein Avatar oder Platzhalter-Bild wird angezeigt
- **AND** die Seite zeigt einen Loading-State (`aria-busy="true"`) waehrend die Daten geladen werden
- **AND** bei einem Ladefehler wird eine Fehlermeldung mit Retry-Button angezeigt

#### Scenario: Basis-Daten bearbeiten
- **WHEN** ein Nutzer seine Basis-Daten (Benutzername, Name, E-Mail, Telefon, Position, Abteilung, Sprache, Zeitzone) aendert
- **AND** das Formular absendet
- **THEN** werden die identitaetsbezogenen Aenderungen in der IAM-Datenbank und in Keycloak gespeichert
- **AND** die Benutzerverwaltung zeigt bei der naechsten Datenladung den aktualisierten Anzeigenamen und die aktualisierte E-Mail
- **AND** Aenderungen an Vor- und Nachname aktualisieren den `displayName`, sofern kein abweichender benutzerdefinierter Anzeigename gepflegt wurde
- **AND** eine Erfolgsbestaetigung wird angezeigt (`role="status"`, `aria-live="polite"`)
- **AND** der `AuthProvider`-State wird aktualisiert
- **AND** der Fokus wird nach dem Speichern auf die Erfolgsbestaetigung gesetzt
