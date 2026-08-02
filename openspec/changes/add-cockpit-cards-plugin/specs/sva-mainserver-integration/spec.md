## ADDED Requirements

### Requirement: Cockpit-Cards-Adapter grenzt GenericItem-Datensätze fachlich ab

Das System MUST Cockpit Cards über den vorhandenen Mainserver-GenericItem-Transport lesen und schreiben. Der Host-Adapter MUST ausschließlich Datensätze mit `genericType` gleich `COCKPIT_CARD` als Cockpit Cards verarbeiten und diesen Wert bei Schreiboperationen erzwingen.

#### Scenario: Liste wird vor lokaler Pagination vollständig gefiltert

- **GIVEN** mehrere Upstream-Seiten mit Cockpit Cards und anderen GenericItems
- **WHEN** ein Benutzer eine Cockpit-Cards-Seite abruft
- **THEN** liest der Adapter alle Upstream-Seiten
- **AND** filtert und sortiert die vollständige Cockpit-Cards-Menge vor der lokalen Pagination

#### Scenario: Fremdtyp-ID kann nicht mutiert werden

- **GIVEN** die ID eines GenericItems mit einem anderen `genericType`
- **WHEN** ein berechtigter Benutzer Detail, Update oder Delete über Cockpit Cards aufruft
- **THEN** liefert der Adapter dieselbe Nichtgefunden-Klassifikation wie bei einer unbekannten ID
- **AND** führt keine Mutation aus

#### Scenario: Schreibvertrag wird serverseitig erzwungen

- **WHEN** eine Cockpit Card angelegt oder aktualisiert wird
- **THEN** erzwingt der Host `genericType` gleich `COCKPIT_CARD`, genau eine Kategorie, mindestens ein Bild und höchstens einen HTTPS-Link
- **AND** weist er fachfremde GenericItem-Felder ab
