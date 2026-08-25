## ADDED Requirements

### Requirement: Mainserver-Diagnostik besitzt eindeutige Fehlerownership und semantische Level

Das System MUST das abschließende Mainserver-Ergebnis an genau einer verantwortlichen Grenze protokollieren. Unerwartete interne oder Providerfehler mit 5xx-Ergebnis MUST dort als `error` erscheinen; erwartbare validierte Ablehnungen dürfen höchstens als `warn` erscheinen. Tiefere Clients MUST Fehler klassifiziert propagieren und dürfen dasselbe operative Ergebnis nicht erneut protokollieren.

#### Scenario: Providerfehler führt zu einem 5xx-Ergebnis

- **WHEN** ein unerwarteter Mainserver-Providerfehler als 5xx-Ergebnis beantwortet wird
- **THEN** emittiert die verantwortliche Mainserver-Routengrenze genau ein korreliertes `error`-Ereignis
- **AND** protokollieren tiefere Client- und Mapper-Schichten kein Duplikat desselben Fehlerereignisses

#### Scenario: Validierte Eingabe wird erwartbar abgelehnt

- **WHEN** eine Mainserver-Operation aufgrund eines erwartbaren fachlichen oder Eingabefehlers abgelehnt wird
- **THEN** emittiert die verantwortliche Grenze höchstens ein `warn`-Ereignis
- **AND** klassifiziert sie das Ergebnis mit einem stabilen Fehlercode ohne Payload oder freien Provider-Fehlertext

### Requirement: Routinemäßige Mainserver-Leseaktivität bleibt unterhalb von Info

Das System MUST erfolgreiche routinemäßige GraphQL-Reads, Credential-Cache-Treffer, Pagination- und Konfigurationszugriffe als `debug` protokollieren oder ohne Einzelereignis lassen. Erfolgreiche fachliche Mutationen dürfen an der verantwortlichen Grenze genau ein `info`-Ereignis erzeugen.

#### Scenario: GraphQL-Read und Credential-Cache sind erfolgreich

- **WHEN** ein GraphQL-Lesezugriff mit Credential-Cache-Treffer ohne Abweichung erfolgreich endet
- **THEN** erzeugen Client und Cache kein `info`-Ereignis pro internem Schritt
- **AND** dürfen diagnostische Details ausschließlich auf `debug` erscheinen

#### Scenario: Fachliche Mutation ist erfolgreich

- **WHEN** eine autorisierte Mainserver-Mutation erfolgreich fachlichen Zustand ändert
- **THEN** darf die verantwortliche Grenze genau ein strukturiertes `info`-Ergebnis mit sicheren Korrelationsfeldern emittieren
- **AND** erzeugen interne Cache- und GraphQL-Schritte keine zusätzlichen `info`-Erfolge
