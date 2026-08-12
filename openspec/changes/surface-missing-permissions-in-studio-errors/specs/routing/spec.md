## ADDED Requirements

### Requirement: Route-Guards erhalten den konkreten Permission-Denial-Kontext

Das Routing MUST bei einer deklarativen Permission-Ablehnung den konkreten, durch den Guard ausgewerteten Denial-Kontext bis zur sichtbaren Fehlermeldung erhalten. Der transportierte Kontext MUST begrenzt, validiert und rein informativ sein und darf weder die Autorisierungsentscheidung noch Navigation oder Serverzugriff freigeben.

#### Scenario: All-of-Route besitzt eine fehlende Permission

- **WHEN** eine Route mehrere Permissions gemeinsam verlangt
- **AND** dem angemeldeten Benutzer eine Teilmenge fehlt
- **THEN** transportiert der Guard nur die tatsächlich fehlenden Permissions mit `allOf`
- **AND** kann die Zielseite daraus die gemeinsame Berechtigungsfehlermeldung darstellen

#### Scenario: Any-of-Route besitzt keine zulässige Alternative

- **WHEN** eine Route eine von mehreren Permissions akzeptiert
- **AND** der angemeldete Benutzer keine davon besitzt
- **THEN** transportiert der Guard die zulässigen Alternativen mit `anyOf`
- **AND** stellt die Zielseite sie nicht als gleichzeitig fehlende Pflichtmenge dar

#### Scenario: Permission-Snapshot ist degradiert

- **WHEN** der Route-Guard keinen belastbaren aktuellen Permission-Snapshot besitzt
- **THEN** verweigert er den Zugriff fail-closed
- **AND** transportiert er einen technischen Autorisierungszustand ohne behauptete fehlende Permission

#### Scenario: Route scheitert an Modul oder technischer Plattformrolle

- **WHEN** der Zugriff wegen fehlender Modulzuweisung oder technischer Plattformrolle verweigert wird
- **THEN** bleibt dieser Grund von einem Permission-Denial unterscheidbar
- **AND** stellt die Zielseite keine Action-ID als fehlende Permission dar

#### Scenario: Manipulierter Denial-Kontext wird konsumiert

- **WHEN** ein Benutzer transportierte Denial-Daten verändert oder unbekannte Action-IDs einfügt
- **THEN** normalisiert und begrenzt die Zielseite die Eingabe vor der Darstellung
- **AND** beeinflusst die Eingabe keine Autorisierungsentscheidung
- **AND** wird der einmalige Denial-Kontext nach dem Konsum entfernt oder invalidiert

#### Scenario: Route-Denial bleibt nach Weiterleitung verständlich

- **WHEN** ein deklarativer Route-Guard zur zentralen Fehlerfläche weiterleitet
- **THEN** bleibt die für die Meldung erforderliche Denial-Semantik bis zur ersten Darstellung erhalten
- **AND** führt ein Reload oder Mehrtab-Zugriff nicht zur Wiederverwendung eines fremden oder veralteten Denial-Kontexts
