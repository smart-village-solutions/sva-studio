## ADDED Requirements

### Requirement: Die Studio-Mainserver-Fassade filtert aktive Kategorien anhand ihrer Datentypen

Die bestehende Active-only-Kategorienroute des Studios MUST optional genau einen unterstützten kanonischen `dataType` akzeptieren. Bei gesetztem Filter MUST sie genau einen bestehenden Mainserver-GraphQL-Read mit dem Feld `dataTypes` ausführen und die Antwort in der Studio-Fassade filtern. Kategorien mit leerer `dataTypes`-Liste MUST für jeden unterstützten Filter enthalten sein; Kategorien mit einem oder mehreren `dataTypes` MUST genau dann enthalten sein, wenn die Liste den angeforderten Typ enthält.

Die Route MUST ungültige Filterwerte vor jedem Upstream-Aufruf ablehnen, fehlende oder nicht validierbare `dataTypes` als ungültige Upstream-Antwort behandeln, keinen ungefilterten Fallback ausführen und ihren parameterlosen bestehenden Vertrag kompatibel erhalten.

#### Scenario: Leere Datentypen gelten für alle unterstützten Filter

- **GIVEN** eine aktive Kategorie besitzt `dataTypes: []`
- **WHEN** die Studio-Fassade Kategorien für `news_item`, `event_record` oder `point_of_interest` lädt
- **THEN** enthält jede dieser gefilterten Antworten die Kategorie

#### Scenario: Mehrere Datentypen werden per exakter Mitgliedschaft ausgewertet

- **GIVEN** eine aktive Kategorie besitzt `dataTypes: ["news_item", "event_record"]`
- **WHEN** die Studio-Fassade Kategorien für `event_record` lädt
- **THEN** enthält die Antwort die Kategorie

#### Scenario: Nicht aufgeführter Datentyp wird ausgeschlossen

- **GIVEN** eine aktive Kategorie besitzt `dataTypes: ["news_item", "event_record"]`
- **WHEN** die Studio-Fassade Kategorien für `point_of_interest` lädt
- **THEN** enthält die Antwort die Kategorie nicht

#### Scenario: Studio filtert einen einzelnen Active-only-Read

- **GIVEN** der Request enthält den unterstützten Datentyp `event_record`
- **WHEN** die Studio-Fassade aktive Kategorien lädt
- **THEN** führt sie genau einen bestehenden Active-only-Mainserver-Read einschließlich `dataTypes` aus
- **AND** gibt sie nur Kategorien mit leerer Typenliste oder enthaltenem `event_record` zurück
- **AND** sendet sie keinen `tagList`- oder `taggingStrategy`-Filter

#### Scenario: Ungültiger Datentyp erreicht den Mainserver nicht

- **GIVEN** der Request enthält einen leeren, mehrfachen oder nicht unterstützten `dataType`-Wert
- **WHEN** die Studio-Fassade den Request verarbeitet
- **THEN** antwortet sie mit dem vorhandenen `invalid_request`-Vertrag
- **AND** führt sie keinen Mainserver-Aufruf aus

#### Scenario: Datentypen fehlen oder sind nicht validierbar

- **GIVEN** eine Kategorie der Upstream-Antwort enthält kein validierbares Stringarray in `dataTypes`
- **WHEN** die Studio-Fassade den gefilterten Request verarbeitet
- **THEN** verwendet sie den vorhandenen `invalid_response`-Pfad
- **AND** behandelt sie den ungültigen Wert nicht als universelle leere Liste
- **AND** gibt sie keine teilweise oder ungefilterte Kategorienliste zurück

#### Scenario: Kategorien-Read schlägt fehl

- **GIVEN** der Mainserver lehnt den Kategorien-Read ab oder liefert insgesamt keine validierbare Antwort
- **WHEN** die Studio-Fassade den Request verarbeitet
- **THEN** verwendet sie den vorhandenen Integrationsfehlerpfad
- **AND** wiederholt sie den Request nicht als alternativen oder ungefilterten Read

#### Scenario: Parameterloser Active-only-Read bleibt kompatibel

- **GIVEN** ein bestehender Consumer ruft die Kategorienroute ohne `dataType` auf
- **WHEN** die Studio-Fassade aktive Kategorien lädt
- **THEN** behält sie den bestehenden parameterlosen Active-only-Antwortvertrag bei
- **AND** lädt sie keine inaktiven Management-Kategorien
