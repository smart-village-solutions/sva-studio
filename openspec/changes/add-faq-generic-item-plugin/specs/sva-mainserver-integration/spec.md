## ADDED Requirements

### Requirement: FAQ-Adapter grenzt GenericItem-Datensätze fachlich ab

Das System MUST FAQ über den bestehenden Mainserver-GenericItem-Transport lesen und schreiben, ohne eine parallele Mainserver-Datenentität einzuführen. Der Host-Adapter MUST ausschließlich GenericItems mit `genericType` gleich `FAQ` als FAQ verarbeiten und beim Schreiben diesen Diskriminator erzwingen.

#### Scenario: FAQ-Read enthält nur FAQ-Datensätze

- **WHEN** die FAQ-Fachliste oder ein FAQ-Detail geladen wird
- **THEN** liefert der Host-Adapter nur GenericItems mit `genericType` gleich `FAQ`
- **AND** verarbeitet er einen abweichenden Typ nicht als FAQ

#### Scenario: Vollständiges Paging wird vor der FAQ-Pagination gefiltert

- **GIVEN** mehrere Mainserver-Seiten, die sowohl FAQ als auch andere GenericItems enthalten
- **WHEN** ein Benutzer eine FAQ-Seite abruft
- **THEN** liest der Adapter alle Upstream-Seiten, bevor er nach `genericType` gleich `FAQ` filtert und sortiert
- **AND** berechnet er die Seite und Gesamtzahl ausschließlich aus der gefilterten FAQ-Menge

#### Scenario: FAQ-Write erzwingt den Diskriminator

- **WHEN** eine FAQ angelegt oder bearbeitet wird
- **THEN** setzt der Host-Adapter `genericType` auf `FAQ`
- **AND** erlaubt der Client nicht, diesen Wert zu verändern

#### Scenario: Fremdtyp-ID kann nicht über FAQ verändert oder gelöscht werden

- **GIVEN** die ID eines GenericItems mit einem `genericType` ungleich `FAQ`
- **WHEN** ein berechtigter Benutzer dessen FAQ-Detail aufruft oder eine FAQ-Update- beziehungsweise Delete-Operation anfordert
- **THEN** liefert der Adapter dieselbe Nichtgefunden-Klassifikation wie für eine unbekannte ID
- **AND** ruft er keine mutierende Mainserver-Operation auf
