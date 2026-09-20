## ADDED Requirements

### Requirement: Content-Editoren bieten ausschließlich datentypgefilterte Kategorien an

Das System MUST die auswählbaren aktiven Kategorien für News mit `news_item`, für Events mit `event_record` und für Points of Interest mit `point_of_interest` anhand ihrer `dataTypes` filtern. Eine Kategorie mit leerer `dataTypes`-Liste MUST für alle Content-Typen angeboten werden. Eine Kategorie mit einem oder mehreren `dataTypes` MUST für jeden exakt enthaltenen Content-Typ angeboten und für andere Typen ausgeschlossen werden. Ein Editor darf bei einem fehlgeschlagenen Read oder ungültigen `dataTypes` nicht auf eine ungefilterte Kategorienliste zurückfallen.

Diese Anforderung gilt für die reguläre Auswahl im Studio und stellt keine serverseitige Kompatibilitätsgarantie für direkte oder manipulierte Schreibzugriffe dar.

#### Scenario: News-Editor lädt passende Kategorien

- **GIVEN** aktive Kategorien mit unterschiedlichen Datentypen existieren
- **WHEN** ein Benutzer die Kategorieauswahl eines News-Beitrags öffnet
- **THEN** bietet das Studio ausschließlich die für `news_item` gefilterten aktiven Kategorien an

#### Scenario: Event-Editor lädt passende Kategorien

- **GIVEN** aktive Kategorien mit unterschiedlichen Datentypen existieren
- **WHEN** ein Benutzer die Kategorieauswahl eines Events öffnet
- **THEN** bietet das Studio ausschließlich die für `event_record` gefilterten aktiven Kategorien an

#### Scenario: POI-Editor lädt passende Kategorien

- **GIVEN** aktive Kategorien mit unterschiedlichen Datentypen existieren
- **WHEN** ein Benutzer die Kategorieauswahl eines Points of Interest öffnet
- **THEN** bietet das Studio ausschließlich die für `point_of_interest` gefilterten aktiven Kategorien an

#### Scenario: Kategorie ohne Datentyp gilt universell

- **GIVEN** eine aktive Kategorie besitzt eine leere `dataTypes`-Liste
- **WHEN** Benutzer die Kategorieauswahl von News, Event oder Point of Interest öffnen
- **THEN** bietet das Studio diese Kategorie in allen drei Editoren an

#### Scenario: Kategorie gilt für mehrere aufgeführte Datentypen

- **GIVEN** eine aktive Kategorie besitzt `dataTypes: ["news_item", "event_record"]`
- **WHEN** Benutzer die Kategorieauswahl von News, Event und Point of Interest öffnen
- **THEN** bietet das Studio diese Kategorie für News und Events an
- **AND** bietet es sie nicht für Points of Interest an

#### Scenario: Kategorien-Read oder Typenvalidierung schlägt fehl

- **GIVEN** der Mainserver-Read schlägt fehl oder liefert fehlende beziehungsweise nicht validierbare `dataTypes`
- **WHEN** ein Content-Editor Kategorieoptionen lädt
- **THEN** zeigt das Studio den vorhandenen lokalisierten Ladefehler
- **AND** führt es keinen ungefilterten Fallback-Read aus
- **AND** bietet es keine neuen Kategorien aus einer ungefilterten Ersatzliste an

### Requirement: Gespeicherte, nicht angebotene Kategoriezuordnungen bleiben entfernbar

Das System MUST eine bereits am Content gespeicherte Kategorie, die im aktuell gefilterten Optionskatalog fehlt, als bestehende Auswahl sichtbar und entfernbar erhalten. Es MUST verhindern, dass diese Kategorie nach ihrer Entfernung erneut aus dem gefilterten Katalog ausgewählt oder bei einer fachfremden Bearbeitung allein wegen ihres Fehlens stillschweigend verworfen wird.

#### Scenario: Bestehende nicht angebotene Zuordnung wird angezeigt

- **GIVEN** ein News-Beitrag enthält eine Kategorie, die der gefilterte `news_item`-Read nicht zurückgibt
- **WHEN** ein Benutzer den Beitrag öffnet
- **THEN** zeigt das Studio die bestehende Kategorie weiterhin als ausgewählten Wert
- **AND** erlaubt es, diese Zuordnung zu entfernen
- **AND** bietet es die Kategorie nicht für eine neue Auswahl an

#### Scenario: Fachfremde Bearbeitung erhält die bestehende Zuordnung im Formular

- **GIVEN** ein Content-Element besitzt eine Kategoriezuordnung, die im gefilterten Optionskatalog fehlt
- **WHEN** ein Benutzer ausschließlich ein anderes editierbares Feld ändert
- **THEN** verwirft der Editor die bestehende Kategoriezuordnung nicht allein wegen ihres Fehlens im Optionskatalog

#### Scenario: Entfernte Zuordnung bleibt nicht auswählbar

- **GIVEN** ein Benutzer hat eine nicht angebotene Kategoriezuordnung aus dem Content entfernt
- **WHEN** der Benutzer die Kategorieauswahl erneut öffnet
- **THEN** erscheint die entfernte Kategorie nicht im auswählbaren gefilterten Katalog
