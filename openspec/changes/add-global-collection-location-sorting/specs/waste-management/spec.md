## ADDED Requirements

### Requirement: Waste-Abholorte werden serverseitig global nach Adresse sortiert

Das System MUST die autorisierte Abholort-Stammdatenliste serverseitig zuerst nach allen aktiven Fachfiltern eingrenzen, danach den vollständigen gefilterten Bestand deterministisch nach einer fest erlaubten Adressfolge sortieren und erst anschließend paginieren. Die Standardsortierung MUST `Ort → Straße → Hausnummer` aufsteigend verwenden; optional MUST die Region als erstes Kriterium vorgeschaltet werden können. Fehlende Werte MUST unabhängig von der Richtung hinter vorhandenen Werten stehen, und die eindeutige Abholort-ID MUST Gleichstände aufsteigend stabilisieren.

#### Scenario: Standardsortierung gilt über mehrere Seiten

- **GIVEN** der gefilterte Abholortbestand umfasst mehr Treffer als auf eine Seite passen
- **WHEN** ein berechtigter Benutzer die Abholort-Stammdatenliste ohne abweichende Sortierparameter öffnet
- **THEN** filtert das System den vollständigen autorisierten Bestand
- **AND** sortiert ihn aufsteigend nach Ort, Straße, Hausnummer und abschließend ID
- **AND** schneidet erst danach die angeforderte Seite zu
- **AND** ein Seitenwechsel erhält dieselbe globale Reihenfolge

#### Scenario: Region wird als erstes Kriterium berücksichtigt

- **WHEN** ein Benutzer die Option `Region berücksichtigen` aktiviert
- **THEN** sortiert das System den vollständigen gefilterten Bestand nach Region, Ort, Straße und Hausnummer
- **AND** gilt die gewählte Richtung gemeinsam für alle vier fachlichen Kriterien
- **AND** bleibt die ID als letzter Gleichstandsauflöser aufsteigend

#### Scenario: Fehlende Werte bleiben in beiden Richtungen zuletzt

- **GIVEN** mindestens ein Abholort besitzt für ein aktives Sortierkriterium keinen Wert
- **WHEN** ein Benutzer aufsteigend oder absteigend sortiert
- **THEN** stehen Abholorte mit vorhandenem Wert vor Abholorten ohne Wert
- **AND** werden zwei Abholorte mit gleichen vorhandenen beziehungsweise fehlenden Fachwerten über ihre ID stabil geordnet

#### Scenario: Hausnummern werden fachlich numerisch geordnet

- **GIVEN** zwei ansonsten gleiche Abholorte besitzen die Hausnummern `2` und `10`
- **WHEN** die Liste aufsteigend nach der Adressfolge sortiert wird
- **THEN** steht Hausnummer `2` vor Hausnummer `10`
- **AND** verwendet die produktive Serverprojektion dieselbe dokumentierte Vergleichssemantik wie die Repository-Integrationstests

#### Scenario: Direkter Request enthält unerlaubte Sortierwerte

- **WHEN** ein direkter API-Request ein unbekanntes Sortierfeld, einen unbekannten Sortiermodus, eine unbekannte Richtung oder widersprüchliche Mehrfachwerte enthält
- **THEN** antwortet das System mit `400 invalid_request`
- **AND** übernimmt es keinen Requestwert als freien SQL-Ausdruck

### Requirement: Abholortlisten-Zustand bleibt über Darstellungen und Pagination konsistent

Das System MUST Sortiermodus, Sortierrichtung, Filter, Seite und Seitengröße als kontrollierten, typisierten Listenzustand führen. Desktop- und schmale Darstellung MUST denselben Sortierzustand bedienen und die empfangene Serverreihenfolge unverändert darstellen. Filter-, Sortier- und Seitengrößenwechsel MUST die Seite auf eins zurücksetzen, ohne ID-basierte Auswahlen anderen Abholorten zuzuordnen.

#### Scenario: Benutzer ändert die Sortierung auf einer späteren Seite

- **GIVEN** ein Benutzer befindet sich auf einer Seite größer als eins
- **WHEN** er Sortiermodus oder Sortierrichtung ändert
- **THEN** navigiert das System atomar auf Seite eins
- **AND** fordert es die neu sortierte erste Seite beim Server an
- **AND** sortiert die Tabellenkomponente diese Seite nicht nochmals lokal

#### Scenario: Filter und Seitengröße setzen die Seite zurück

- **WHEN** ein Benutzer Suche, Status, Region, Ort, Tour oder Seitengröße ändert
- **THEN** wird die Seite auf eins gesetzt
- **AND** Gesamtzahl und Seiteninhalt beruhen auf demselben serverseitigen Filtervertrag

#### Scenario: Desktop und schmale Ansicht teilen den Zustand

- **WHEN** ein Benutzer Sortiermodus oder Richtung über eine der beiden Darstellungen ändert
- **THEN** zeigen beide Darstellungen denselben aktiven Modus und dieselbe Richtung an
- **AND** sind Kriterien, Richtung und Bedienung für Maus, Tastatur und Screenreader verständlich

#### Scenario: Auswahl bleibt an IDs gebunden

- **GIVEN** ein Benutzer hat Abholorte auf einer oder mehreren Seiten ausgewählt
- **WHEN** er Seite, Sortierung oder Filter ändert
- **THEN** bleibt jede Auswahl ausschließlich ihrer Abholort-ID zugeordnet
- **AND** eine neu sichtbare Zeile übernimmt keinen Auswahlzustand über ihren Zeilenindex
- **AND** Auswahlen außerhalb des aktuellen Filters bleiben erhalten

#### Scenario: Alle gefilterten Abholorte werden seitenübergreifend ausgewählt

- **WHEN** ein Benutzer `Alle gefilterten auswählen` aktiviert
- **THEN** löst das System alle Abholort-IDs über denselben serverseitigen Filtervertrag wie die Liste auf
- **AND** begrenzt es die Auswahl nicht auf die sichtbare Seite
- **AND** beeinflussen Sortiermodus und Pagination nicht die ermittelte ID-Menge
