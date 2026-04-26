## ADDED Requirements

### Requirement: Registrierte Admin-Ressourcen verwenden namespacete Ressourcen-IDs

Das Routing-System MUST fuer registrierte plugin-beigestellte Admin-Ressourcen eine fully-qualified Ressourcen-ID im Format `<namespace>.<resourceName>` verwenden.

#### Scenario: Plugin registriert namespacete Admin-Ressource

- **WHEN** ein Plugin mit Namespace `news` eine Admin-Ressource registriert
- **THEN** verwendet die Ressourcen-ID das Format `news.<resourceName>`
- **AND** die Host-Registrierung kann Ownership und Kollisionen ueber diese ID deterministisch pruefen

#### Scenario: Plugin registriert Admin-Ressource ohne Namespace

- **WHEN** ein Plugin eine Admin-Ressource mit einer ID wie `articles` ohne Namespace registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen
- **AND** der Host erzeugt daraus keine implizit namespacete Ressourcen-ID

#### Scenario: Plugin registriert Admin-Ressource in fremdem Namespace

- **WHEN** ein Plugin mit Namespace `news` eine Ressourcen-ID wie `events.articles` registriert
- **THEN** wird die Registrierung mit einem Ownership-Fehler abgewiesen
- **AND** der fremde Namespace bleibt fuer das owning Plugin oder den Host reserviert
