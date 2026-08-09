## ADDED Requirements

### Requirement: Fachplugins deklarieren ihre GenericItem-Zuständigkeit eindeutig

Das System MUST einem registrierten Plugin-Content-Type erlauben, genau einen übernommenen Mainserver-`genericType` als exakten Diskriminator zu deklarieren. Die Build-time-Registry MUST leere Diskriminatoren sowie mehrere Content-Types mit demselben Diskriminator ablehnen. Das Generic-Items-Plugin MUST ohne Wildcard-Deklaration als Fallback bestehen bleiben.

#### Scenario: Fachplugin übernimmt einen GenericItem-Typ

- **GIVEN** das Projekte-Plugin registriert `FeaturedProject` für `projects.project`
- **WHEN** die Build-time-Registry aufgebaut wird
- **THEN** enthält ihr unveränderlicher Snapshot diese eindeutige Zuständigkeit
- **AND** kann der Host daraus die zentrale GenericItem-Klassifikation ableiten

#### Scenario: Zwei Plugins beanspruchen denselben Diskriminator

- **GIVEN** zwei registrierte Content-Types deklarieren denselben `genericType`
- **WHEN** die Build-time-Registry validiert wird
- **THEN** schlägt ihr Aufbau mit einem Ownership-Fehler fehl
- **AND** wählt das System keinen Content-Type anhand der Registrierungsreihenfolge aus

#### Scenario: Abweichende Großschreibung bleibt ein anderer Typ

- **GIVEN** ein Fachplugin deklariert `FAQ`
- **WHEN** ein GenericItem den Wert `faq` besitzt
- **THEN** beansprucht das Fachplugin diesen Datensatz nicht
- **AND** bleibt er dem generischen Fallback zugeordnet

#### Scenario: Server baut die Zuordnung ohne Browser-Entrypoint auf

- **GIVEN** ein aktiviertes Fachplugin deklariert seine GenericItem-Zuständigkeit in einem server-sicheren Ownership-Modul
- **WHEN** der Host die Mainserver-Zuordnung materialisiert
- **THEN** verwendet er ausschließlich diese kleine Deklaration
- **AND** lädt weder den Browser-Plugin-Snapshot noch React-Flächen oder Browser-Logger
