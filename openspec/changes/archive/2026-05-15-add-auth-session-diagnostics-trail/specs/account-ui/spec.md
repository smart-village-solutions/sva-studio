## MODIFIED Requirements

### Requirement: Auth-State-Provider

Das System MUST einen zentralen React-Context (`AuthProvider` in `sva-studio-react`) bereitstellen, der den Authentifizierungs-State anwendungsweit verfügbar macht, verteilte `/auth/me`-Aufrufe durch einen einheitlichen `useAuth()`-Hook ersetzt und Auth-Unterbrechungen strukturiert diagnostizierbar macht.

#### Scenario: Authentifizierter Nutzer lädt die Anwendung

- **WENN** ein authentifizierter Nutzer die Anwendung öffnet
- **DANN** lädt der `AuthProvider` die User-Daten über `/auth/me`
- **UND** stellt `{ user, isAuthenticated: true, isLoading: false }` über `useAuth()` bereit
- **UND** alle Komponenten, die `useAuth()` nutzen, erhalten denselben State ohne eigene API-Aufrufe

#### Scenario: Nicht-authentifizierter Nutzer

- **WENN** ein nicht-authentifizierter Nutzer die Anwendung öffnet
- **DANN** gibt der `AuthProvider` `{ user: null, isAuthenticated: false, isLoading: false }` zurück
- **UND** der `/auth/me`-Aufruf wird nicht wiederholt, bis ein expliziter Refetch ausgelöst wird

#### Scenario: Token-Refresh während der Session

- **WENN** der Access-Token während einer aktiven Session abläuft
- **UND** der Refresh-Token noch gültig ist
- **DANN** aktualisiert der `AuthProvider` die User-Daten automatisch nach dem Server-seitigen Token-Refresh
- **UND** die Anwendung zeigt keinen Ladeindikator während des stillen Refreshs

#### Scenario: Stale-Permissions-Erkennung

- **WENN** ein API-Call `403 Forbidden` zurückgibt und der Nutzer eigentlich berechtigt sein sollte
- **DANN** wird `invalidatePermissions()` aufgerufen
- **UND** `/auth/me` wird refetcht, um den aktuellen Berechtigungsstand zu aktualisieren

#### Scenario: Session expired notice keeps correlated diagnostics

- **WENN** ein Benutzer nach fehlgeschlagener stiller Session-Recovery auf `/?auth=session-expired` geleitet wird
- **DANN** bleibt ein lokaler, tab-bezogener Auth-Diagnosepfad für den Vorfall erhalten
- **UND** die Oberfläche darf mindestens `requestId` und `authFlowId` sichtbar machen
- **UND** der Diagnosepfad enthält keine Tokens und keine PII
