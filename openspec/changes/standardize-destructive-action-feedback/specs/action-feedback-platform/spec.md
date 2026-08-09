## ADDED Requirements

### Requirement: Destruktive Rückmeldung folgt der belegten Wiederherstellbarkeit

Das System MUST destruktive Aktionen anhand ihres serverseitig belegten Wiederherstellungsvertrags als reversibel oder irreversibel behandeln. Die UI darf keine Wiederherstellbarkeit versprechen, die nicht autorisiert, getestet und serverautoritativ verfügbar ist.

#### Scenario: Aktion besitzt einen belastbaren Restore-Vertrag

- **WHEN** eine destruktive Aktion einen autorisierten und zeitlich definierten Restore-Pfad besitzt
- **THEN** darf die UI eine kontextbezogene Undo-Aktion anbieten
- **AND** bleibt der Serverzustand die führende Wahrheit für Wiederherstellung und Ablauf

#### Scenario: Aktion besitzt keinen Restore-Vertrag

- **WHEN** eine destruktive Aktion keinen belastbaren Restore-Pfad besitzt
- **THEN** bietet die UI kein vermeintliches Undo an
- **AND** behandelt die Aktion als irreversibel oder verweist auf einen getrennten fachlichen Recovery-Pfad

### Requirement: Irreversible oder hochwirksame Aktionen erfordern eine echte Bestätigung

Das System MUST vor irreversiblen, hochwirksamen oder konfliktbehafteten Aktionen eine zugängliche Bestätigung einholen, die Ziel, Aktion und wesentliche Konsequenz eindeutig benennt.

#### Scenario: Benutzer bestätigt einen Hard Delete

- **WHEN** ein Benutzer einen irreversiblen Hard Delete auslöst
- **THEN** benennt der Dialog den betroffenen Datensatz und die Endgültigkeit der Aktion
- **AND** kann der Benutzer eindeutig bestätigen oder abbrechen
- **AND** wird die Mutation erst nach der Bestätigung ausgeführt

#### Scenario: Benutzer bricht die Aktion ab

- **WHEN** der Benutzer die Bestätigung abbricht
- **THEN** wird keine Mutation ausgeführt
- **AND** kehrt der Fokus in einen sinnvollen Ausgangskontext zurück

### Requirement: Reversible Ergebnisse bieten serverautoritatives Undo

Das System MUST eine angebotene Undo-Aktion idempotent und innerhalb des serverseitig definierten Zeitfensters ausführen.

#### Scenario: Undo wird rechtzeitig erfolgreich ausgeführt

- **WHEN** der Benutzer innerhalb des gültigen Zeitfensters Undo auslöst
- **THEN** stellt der Server das Objekt über den vorgesehenen Restore- oder Kompensationspfad wieder her
- **AND** aktualisiert die UI den betroffenen stabilen Kontext aus der serverseitigen Wahrheit

#### Scenario: Undo ist abgelaufen oder kollidiert

- **WHEN** das Zeitfenster abgelaufen ist oder eine konkurrierende Änderung die Wiederherstellung verhindert
- **THEN** erscheint eine persistente konkrete Fehlermeldung
- **AND** wird kein Wiederherstellungserfolg behauptet

### Requirement: Destruktive Fehler bleiben im Handlungskontext persistent

Das System MUST Fehler der Primäraktion und des Undo-/Restore-Pfads persistent am betroffenen Dialog-, Detail-, Listen- oder Bereichskontext darstellen.

#### Scenario: Delete schlägt technisch fehl

- **WHEN** die destruktive Mutation technisch oder serverseitig fehlschlägt
- **THEN** bleibt das Objekt entsprechend der serverseitigen Wahrheit sichtbar oder wird neu geladen
- **AND** verschwindet die Fehlermeldung nicht automatisch
- **AND** darf eine sichere konkrete Wiederholungsaktion angeboten werden

### Requirement: Host und Plugins verwenden gemeinsame destruktive Primitives

Das System MUST die Basisdarstellung für Bestätigung, Ergebnis, Undo und persistente Fehler über `@sva/studio-ui-react` bereitstellen. Fachliche Klassifikation, Mutation, Berechtigung und Restore-Vertrag verbleiben im jeweiligen Host- oder Plugin-Flow.

#### Scenario: Plugin stellt eine Löschaktion bereit

- **WHEN** ein Plugin eine destruktive Aktion rendert
- **THEN** verwendet es die gemeinsamen UI-Primitives
- **AND** führt es keinen eigenen Toast-Stack oder paralleles Bestätigungs-/Undo-Basissystem ein
