## ADDED Requirements

### Requirement: Waste-Fraktionen werden vor der Pagination global sortiert

Das System MUST die Fraktionenliste zuerst nach dem aktuellen Statusfilter eingrenzen, danach den vollständigen gefilterten Bestand deterministisch sortieren und erst anschließend paginieren. Die Liste MUST standardmäßig nach Name aufsteigend sortieren, fehlende optionale Werte unabhängig von der Richtung zuletzt einordnen und Gleichstände mit `ID asc` stabilisieren.

#### Scenario: Benutzer sortiert Fraktionen über mehrere Seiten

- **GIVEN** der aktuelle Fraktionenfilter ergibt mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer Sortierfeld oder Sortierrichtung ändert
- **THEN** sortiert die Fachlogik den vollständigen gefilterten Fraktionenbestand
- **AND** schneidet sie erst danach die erste Ergebnisseite zu
- **AND** verändert die gemeinsame Tabellenkomponente die Reihenfolge dieser Seite nicht nochmals lokal

#### Scenario: Optionale Fraktionswerte bleiben am Ende

- **GIVEN** mindestens eine Fraktion besitzt keinen Wert im gewählten optionalen Sortierfeld
- **WHEN** ein Benutzer aufsteigend oder absteigend sortiert
- **THEN** steht die Fraktion ohne Wert in beiden Richtungen nach Fraktionen mit vorhandenem Wert
- **AND** verwendet die Fachlogik kein anderes Feld als Ersatz
