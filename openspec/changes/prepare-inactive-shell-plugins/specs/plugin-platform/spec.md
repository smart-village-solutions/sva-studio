## ADDED Requirements

### Requirement: Vorbereitete Plugins bleiben sichtbar und inaktiv

Das System MUST Plugins im Status `in-development` im Studio-Katalog führen können, ohne sie in den Runtime-Snapshot oder die zuweisbaren Instanzmodule aufzunehmen. Ein solcher Katalogeintrag MUST `enabled: false` haben.

#### Scenario: Vorbereitetes Plugin erscheint in der Modulübersicht

- **GIVEN** ein Plugin steht mit `availability: in-development` und `enabled: false` im Studio-Katalog
- **WHEN** die Modulübersicht geöffnet wird
- **THEN** erscheint es mit dem lokalisierten Status „In Entwicklung“
- **AND** es bietet keine Zuweisungsaktion und keinen Header-Einstieg

#### Scenario: Entwicklungsstatus kann nicht aktiviert werden

- **GIVEN** ein Katalogeintrag trägt `availability: in-development`
- **WHEN** der Eintrag gleichzeitig mit `enabled: true` normalisiert wird
- **THEN** wird er vor der Snapshot-Materialisierung abgelehnt
