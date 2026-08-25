## ADDED Requirements

### Requirement: Destruktive Rückmeldung führt kein Undo ein

Das System MUST destruktive Ergebnisse ohne kurzfristige Undo- oder clientseitige Kompensationszusage darstellen. Ein vorhandener fachlicher Restore-Pfad MUST als eigenständige autorisierte Aktion behandelt werden und darf nicht implizit Bestandteil des Feedback-Primitives sein.

#### Scenario: Destruktive Aktion wurde abgeschlossen

- **WHEN** eine destruktive Aktion erfolgreich abgeschlossen wurde
- **THEN** bietet die Rückmeldung kein Undo an
- **AND** behauptet sie keine automatische oder zeitlich begrenzte Wiederherstellbarkeit

#### Scenario: Fachbereich besitzt einen Restore-Pfad

- **WHEN** ein gelöschtes oder archiviertes Objekt über einen fachlichen Restore-Vertrag wiederhergestellt werden kann
- **THEN** bleibt Restore eine separat benannte und autorisierte Fachaktion
- **AND** erhält das destruktive Feedback dadurch keinen Undo-Zustand

### Requirement: Destruktive oder hochwirksame Aktionen erfordern eine echte Bestätigung

Das System MUST vor destruktiven, hochwirksamen oder konfliktbehafteten Aktionen eine zugängliche Bestätigung einholen, die Ziel, Aktion und wesentliche Konsequenz eindeutig benennt.

#### Scenario: Benutzer bestätigt einen Hard Delete

- **WHEN** ein Benutzer einen irreversiblen Hard Delete auslöst
- **THEN** benennt der Dialog den betroffenen Datensatz und die Endgültigkeit der Aktion
- **AND** kann der Benutzer eindeutig bestätigen oder abbrechen
- **AND** wird die Mutation erst nach der Bestätigung ausgeführt

#### Scenario: Benutzer bricht die Aktion ab

- **WHEN** der Benutzer die Bestätigung abbricht
- **THEN** wird keine Mutation ausgeführt
- **AND** kehrt der Fokus in einen sinnvollen Ausgangskontext zurück

#### Scenario: Bestätigte Mutation läuft

- **WHEN** die bestätigte destruktive Mutation noch nicht abgeschlossen ist
- **THEN** kann die Aktion nicht erneut bestätigt werden
- **AND** kann der Dialog nicht versehentlich geschlossen werden
- **AND** bleibt der laufende Zustand für den Benutzer erkennbar

### Requirement: Destruktive Erfolge bleiben im stabilen Kontext nachvollziehbar

Das System MUST den Erfolg einer destruktiven Aktion im nächstgelegenen stabilen Detail-, Listen- oder Bereichskontext darstellen. Die Rückmeldung MUST an den konkreten Abschluss gebunden sein und darf nicht ausschließlich als flüchtiger globaler Toast erscheinen.

#### Scenario: Gelöschtes Objekt verlässt den Detailkontext

- **WHEN** ein Objekt erfolgreich gelöscht wurde und seine Detailseite nicht mehr gültig ist
- **THEN** navigiert die UI in den kanonischen Eltern- oder Listenkontext
- **AND** zeigt dort das konkrete Ergebnis ohne automatisches Ausblenden
- **AND** wird die Rückmeldung bei einem späteren erneuten Aufruf nicht wiederholt

#### Scenario: Destruktive Aktion bleibt im aktuellen Bereich

- **WHEN** nach erfolgreicher Aktion ein stabiler Listen- oder Bereichskontext sichtbar bleibt
- **THEN** aktualisiert die UI diesen Kontext aus der serverseitigen Wahrheit
- **AND** zeigt das konkrete Ergebnis in diesem Bereich

### Requirement: Destruktive Fehler bleiben im Handlungskontext persistent

Das System MUST Fehler der destruktiven Mutation persistent am betroffenen Dialog-, Detail-, Listen- oder Bereichskontext darstellen.

#### Scenario: Delete schlägt technisch fehl

- **WHEN** die destruktive Mutation technisch oder serverseitig fehlschlägt
- **THEN** bleibt das Objekt entsprechend der serverseitigen Wahrheit sichtbar oder wird neu geladen
- **AND** verschwindet die Fehlermeldung nicht automatisch
- **AND** darf eine sichere konkrete Wiederholungsaktion angeboten werden

### Requirement: Host und Plugins verwenden gemeinsame destruktive Primitives

Das System MUST die Basisdarstellung für Bestätigung, laufenden Zustand, Ergebnis und persistente Fehler über `@sva/studio-ui-react` bereitstellen. Fachliche Mutation, Berechtigung, Zielbezeichnung, Konsequenz und Fehlerübersetzung verbleiben im jeweiligen Host- oder Plugin-Flow.

#### Scenario: Plugin stellt eine Löschaktion bereit

- **WHEN** ein Plugin eine destruktive Aktion rendert
- **THEN** verwendet es die gemeinsamen UI-Primitives
- **AND** führt es keinen eigenen Toast-Stack oder paralleles Bestätigungs-/Undo-Basissystem ein

#### Scenario: Bestehender Plugin-Flow wird vollständig migriert

- **WHEN** ein bestehendes Plugin eine persistierte Einzel- oder Bulk-Löschung, einen hochwirksamen Reset oder eine lokale Entwurfsentfernung anbietet
- **THEN** verwendet der Flow `StudioDestructiveActionDialog`
- **AND** verwendet er weder eine browsernative Bestätigung noch `StudioConfirmDialog` für diese destruktive Wirkung

#### Scenario: Sicherheitsabfrage ist nicht destruktiv

- **WHEN** ein Plugin eine nicht-destruktive Sicherheitsentscheidung wie Push-Versand, degradierte Feldkorrektur oder Holiday-Overwrite bestätigt
- **THEN** darf es weiterhin den allgemeinen Bestätigungsdialog verwenden
- **AND** wird die Abfrage nicht fälschlich als destruktive Aktion dargestellt
