## ADDED Requirements

### Requirement: Kontextgebundener Save-Button bildet den Speicherstatus ab

Das System MUST normale Create- und Update-Speicheraktionen im sichtbaren Formular- oder Bereichskontext über einen gemeinsamen Save-Button rückmelden.

Der Button MUST die Zustände `Speichern`, `Wird gespeichert…` und `Gespeichert` abbilden. Der Erfolgszustand MUST mit einem sichtbaren Check-Icon dargestellt werden, genau zwei Sekunden bestehen bleiben und bei einer neuen Formulareingabe sofort zum Standardzustand zurückkehren.

#### Scenario: Update wird erfolgreich gespeichert

- **WHEN** ein Benutzer ein bestehendes Objekt erfolgreich speichert
- **THEN** zeigt der Save-Button während der Mutation `Wird gespeichert…`
- **AND** verhindert einen weiteren Submit derselben Aktion
- **AND** zeigt anschließend für zwei Sekunden `✓ Gespeichert`
- **AND** kehrt danach zu `Speichern` zurück

#### Scenario: Benutzer ändert das Formular während des Erfolgszustands

- **GIVEN** der Save-Button zeigt `✓ Gespeichert`
- **WHEN** der Benutzer einen Formularwert ändert
- **THEN** kehrt der Button sofort zu `Speichern` zurück
- **AND** ein noch laufender Erfolgs-Timer erzeugt später keinen weiteren Zustandswechsel

#### Scenario: Neuer Submit ersetzt einen älteren Save-Lifecycle

- **WHEN** nach einem abgeschlossenen Save ein neuer Submit beginnt
- **THEN** wird ein noch laufender Erfolgs-Timer verworfen
- **AND** darf ein veralteter Request-Abschluss den Zustand des aktuellen Submits nicht überschreiben

### Requirement: Save-Erfolg bleibt zugänglich und nicht blockierend

Das System MUST den Save-Erfolg ohne Fokusverschiebung zugänglich ankündigen und visuelle Layoutsprünge beim Labelwechsel vermeiden.

#### Scenario: Assistenztechnologie erhält die Erfolgsmeldung

- **WHEN** der Save-Button in den Zustand `Gespeichert` wechselt
- **THEN** wird der Erfolg über eine höfliche Live-Region angekündigt
- **AND** bleibt der Fokus an seiner bisherigen Position
- **AND** ist das Check-Icon für Assistenztechnologien dekorativ verborgen

#### Scenario: Buttonlabel wechselt zwischen Save-Zuständen

- **WHEN** der Button zwischen `Speichern`, `Wird gespeichert…` und `Gespeichert` wechselt
- **THEN** behält die Aktionsfläche eine stabile Mindestbreite
- **AND** verursacht der Statuswechsel keinen vermeidbaren Layoutsprung

### Requirement: Validierungsfehler erscheinen am betroffenen Feld

Das System MUST auf konkrete Felder abbildbare Validierungsfehler direkt an diesen Feldern darstellen und semantisch mit den jeweiligen Controls verknüpfen.

Bei mehreren Validierungsfehlern MAY zusätzlich oberhalb des Formulars eine verlinkte Zusammenfassung erscheinen.

#### Scenario: Einzelnes Feld ist ungültig

- **WHEN** ein Submit wegen eines auf ein Feld abbildbaren Validierungsfehlers abgelehnt wird
- **THEN** erscheint die Fehlermeldung direkt am betroffenen Feld
- **AND** referenziert das Control die Meldung über seine Accessibility-Attribute
- **AND** zeigt der Save-Button keinen Erfolgszustand

#### Scenario: Mehrere Felder sind ungültig

- **WHEN** mehrere auf Felder abbildbare Validierungsfehler gleichzeitig vorliegen
- **THEN** bleiben alle Meldungen an ihren jeweiligen Feldern sichtbar
- **AND** darf eine zusätzliche Zusammenfassung die Fehler aufführen und auf die jeweiligen Controls fokussierbar verweisen

### Requirement: Technische Speicherfehler bleiben persistent und handlungsorientiert

Das System MUST technische, API- und Serverfehler persistent im betroffenen Formular oder Bereich darstellen. Die Meldung MUST deutlich als Fehler ausgezeichnet sein, darf nicht automatisch verschwinden und SHOULD eine konkrete sichere Folgeaktion wie `Erneut versuchen` anbieten.

#### Scenario: API-Speicheraufruf schlägt fehl

- **WHEN** eine Save-Mutation technisch oder serverseitig fehlschlägt
- **THEN** kehrt der Save-Button zu `Speichern` zurück
- **AND** erscheint eine persistente Fehlermeldung mit Alert-Semantik im betroffenen Kontext
- **AND** verschwindet die Meldung nicht durch einen Timer

#### Scenario: Benutzer wiederholt eine fehlgeschlagene Speicherung

- **GIVEN** der Fehler kann fachlich sicher wiederholt werden
- **WHEN** der Benutzer `Erneut versuchen` auslöst
- **THEN** wird nur die vorgesehene Save-Aktion erneut ausgeführt
- **AND** bleibt der bisherige Fehler bis zum erfolgreichen Abschluss oder einer eindeutigen Statusaktualisierung sichtbar
- **AND** wird die Fehlermeldung nach erfolgreichem Abschluss entfernt

### Requirement: Partielle Speicherergebnisse sind kein vollständiger Erfolg

Das System MUST einen erfolgreichen Primärwrite mit fehlgeschlagenem erforderlichem Folgeschritt als partielles Ergebnis statt als vollständig gespeichert darstellen.

#### Scenario: Medienreferenzen scheitern nach erfolgreichem Inhaltswrite

- **WHEN** der Inhalt gespeichert wurde, aber die erforderliche Synchronisierung der Medienreferenzen fehlschlägt
- **THEN** zeigt der Save-Button nicht `✓ Gespeichert`
- **AND** beschreibt eine persistente Meldung den partiellen Zustand konkret
- **AND** wiederholt eine angebotene Retry-Aktion ausschließlich den fehlgeschlagenen Referenzschritt
- **AND** wird der erfolgreiche Primärwrite nicht unbeabsichtigt erneut ausgeführt

#### Scenario: Partieller Fehler ist nicht sicher wiederholbar

- **WHEN** für einen fehlgeschlagenen Folgeschritt keine sichere automatische Wiederholung existiert
- **THEN** bietet die Meldung keinen irreführenden generischen Retry an
- **AND** beschreibt sie stattdessen die nächste sichere Handlung

### Requirement: Erfolgreiche Create-Flows wechseln in den erzeugten Detailkontext

Das System MUST nach einer erfolgreichen Anlage auf die kanonische Detailroute des neu erzeugten Datensatzes wechseln und dort den Save-Erfolg einmalig anzeigen.

#### Scenario: Datensatz wird erfolgreich angelegt

- **WHEN** ein Create-Submit erfolgreich einen Datensatz erzeugt
- **THEN** navigiert die UI auf dessen kanonische Detailroute
- **AND** zeigt der Save-Button dort einmalig für zwei Sekunden `✓ Gespeichert`
- **AND** ist der transiente Erfolg an die erzeugte Datensatz-ID gebunden

#### Scenario: Detailseite wird später erneut geöffnet

- **WHEN** der Benutzer die Detailseite neu lädt, zurücknavigiert oder später erneut öffnet
- **THEN** wird der frühere Create-Erfolg nicht erneut angezeigt
- **AND** liegt der Erfolgszustand weder in Search-Params noch im Datensatz oder einem langlebigen globalen Store

#### Scenario: Transienter Erfolg gehört zu einem anderen Datensatz

- **WHEN** der Zielscreen einen veralteten oder zu einer anderen Datensatz-ID gehörenden transienten Zustand erhält
- **THEN** ignoriert er diesen Zustand
- **AND** zeigt keinen falschen Save-Erfolg

### Requirement: Normale Speicherergebnisse verwenden keine globalen oder blockierenden Surfaces

Das System MUST normale Create- und Update-Ergebnisse ohne Toast, Modal oder Overlay darstellen, solange ein sichtbarer Formular- oder Bereichskontext vorhanden ist.

#### Scenario: Normale Speicherung ist erfolgreich

- **WHEN** eine normale Create- oder Update-Aktion erfolgreich abgeschlossen wird
- **THEN** erscheint der Erfolg am Save-Button
- **AND** wird kein zusätzlicher Save-Erfolgs-Toast angezeigt
- **AND** öffnet sich kein Modal oder Overlay

#### Scenario: Normale Speicherung schlägt technisch fehl

- **WHEN** eine normale Create- oder Update-Aktion technisch fehlschlägt
- **THEN** erscheint der Fehler persistent im betroffenen Formular oder Bereich
- **AND** ist ein flüchtiger globaler Toast nicht die einzige oder zusätzliche Standardrückmeldung
- **AND** öffnet sich kein Modal oder Overlay, sofern keine tatsächliche Nutzerentscheidung erforderlich ist

### Requirement: Host und Plugins verwenden dieselben Save-Primitives

Das System MUST Save-Darstellung, Timing und Accessibility für Host- und Plugin-Formulare über `@sva/studio-ui-react` bereitstellen. Fachliche Validierung, Mutation, Fehlerübersetzung, Retry-Semantik sowie Dirty- und Reset-Verhalten MUST im jeweiligen Host- oder Plugin-Flow verbleiben.

#### Scenario: Plugin implementiert einen normalen Save-Flow

- **WHEN** ein Plugin einen Create- oder Update-Flow bereitstellt
- **THEN** verwendet es die gemeinsamen Save- und Fehler-Primitives aus `@sva/studio-ui-react`
- **AND** führt keinen eigenen Save-Timer, Basis-Save-Button, Toast-Stack oder globalen Feedback-Renderer ein

#### Scenario: Host-Formular implementiert einen normalen Save-Flow

- **WHEN** ein Host-Formular einen Create- oder Update-Flow bereitstellt
- **THEN** verwendet es dieselben Save- und Fehler-Primitives wie Plugin-Formulare
- **AND** verbleiben fachliche Mutation und Fehlerübersetzung im Host-Flow
