## MODIFIED Requirements

### Requirement: Token Validation & User Identity
Das System MUST von Keycloak ausgestellte JWT-Tokens validieren und nur die fuer Session- und Autorisierungspfad erforderlichen Identity-Claims extrahieren.

#### Scenario: User context extraction

- **WHEN** ein Token gueltig ist
- **THEN** extrahiert das System mindestens die Claims `sub` (Benutzer-ID), `instanceId` und Rollen-/Berechtigungsinformationen
- **AND** `email` oder `name` sind keine Pflichtclaims fuer Session-Hydration oder Autorisierung
- **AND** zusaetzliche Profildaten werden nur in dedizierten Profil-/Sync-Flows geladen
- **AND** das System injiziert daraus einen minimalen `UserContext` fuer nachgelagerte Handler

### Requirement: Session Management
Das System MUST Benutzersitzungen sicher verwalten, einschließlich automatischer Ablaufbehandlung, Token-Erneuerung und eines minimalen Session-Nutzermodells.

#### Scenario: AuthProvider-Integration mit Session

- **WENN** die `AuthProvider`-Komponente (in `sva-studio-react`) gemountet wird
- **DANN** ruft sie `/auth/me` auf, um die aktuelle Sitzung aufzulösen
- **UND** bei gueltiger Sitzung liefert `useAuth()` einen minimalen User-Kontext mit `id`, optionalem `instanceId` und Rollen
- **UND** Profilattribute wie Anzeigename oder E-Mail werden nicht implizit aus `/auth/me` erwartet

### Requirement: SDK Logger for IAM Server Modules
Das System MUST den SDK Logger (`createSdkLogger` aus `@sva/sdk`) fuer alle operativen Logs in IAM-Servermodulen verwenden und tokenhaltige oder personenbeziehbare Werte minimieren.

#### Scenario: Structured logging with mandatory fields

- **WHEN** ein IAM-Servermodul einen Log-Eintrag erzeugt
- **THEN** enthaelt der Eintrag mindestens: `workspace_id` (= `instanceId`), `component` (z. B. `iam-auth`), `environment`, `level`
- **AND** PII-Redaktion wird automatisch durch den SDK Logger angewendet
- **AND** es erscheinen keine Klartext-Tokens, tokenhaltigen Redirect-URLs, Session-IDs oder E-Mail-Adressen in operativen Logs

## ADDED Requirements

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
