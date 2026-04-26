## ADDED Requirements

### Requirement: Admin-Routen werden aus registrierten Admin-Ressourcen materialisiert

Das Routing-System SHALL kanonische Admin-Routen aus einem deklarativen Registrierungsvertrag fuer Admin-Ressourcen ableiten, statt neue CRUD-artige Admin-Flaechen individuell im Host zu verdrahten.

#### Scenario: Listen-, Create- und Detailroute entstehen aus einem Ressourcenvertrag

- **WHEN** der Host eine Admin-Ressource mit Basispfad `<resource>` registriert
- **THEN** materialisiert das Routing daraus mindestens `/admin/<resource>`, `/admin/<resource>/new` und `/admin/<resource>/$id`
- **AND** die Route-Bildung folgt fuer alle registrierten CRUD-Ressourcen demselben kanonischen Muster

#### Scenario: Historienroute bleibt optionaler Vertragsteil

- **WHEN** eine Admin-Ressource zusaetzlich einen History-Beitrag deklariert
- **THEN** kann das Routing eine zugehoerige Historienansicht aus demselben Ressourcenvertrag materialisieren
- **AND** das Fehlen eines History-Beitrags verhindert nicht die Registrierung der Basisrouten

### Requirement: Der Host erzwingt Konfliktfreiheit bei Admin-Ressourcen

Das Routing-System MUST Konflikte zwischen registrierten Admin-Ressourcen deterministisch erkennen und fail-fast behandeln.

#### Scenario: Doppelte Ressourcen-ID oder kollidierender Basispfad

- **WHEN** zwei Ressourcendefinitionen dieselbe Ressourcen-ID oder denselben kanonischen Basispfad beanspruchen
- **THEN** bricht die Registrierungsphase deterministisch mit einem Konfliktfehler ab
- **AND** es wird kein teilweise inkonsistenter Admin-Route-Baum veroeffentlicht
