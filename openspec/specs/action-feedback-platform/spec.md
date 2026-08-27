# action-feedback-platform Specification

## Purpose
Diese Spezifikation definiert die einheitliche, kontextgebundene und barrierefreie Rückmeldung für Speicheraktionen in Host- und Plugin-Formularen.
## Requirements
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

### Requirement: Erfolgreiche seitengebundene Create-Flows wechseln in den erzeugten Detailkontext

Das System MUST nach einer erfolgreichen Anlage in einem seitengebundenen Create-Flow auf die kanonische Detailroute des neu erzeugten Datensatzes wechseln und dort den Save-Erfolg einmalig anzeigen. Untergeordnete Dialoge ohne eigene Detailroute und mehrstufige Setup-Flows MAY stattdessen im unmittelbar sichtbaren Ergebnis- beziehungsweise Einrichtungskontext verbleiben.

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

#### Scenario: Untergeordneter Create-Dialog besitzt keine Detailroute

- **WHEN** ein untergeordneter Create-Dialog erfolgreich einen Datensatz erzeugt und keine eigene Detailroute besitzt
- **THEN** darf sich der Dialog schließen
- **AND** erscheint der erzeugte Datensatz unmittelbar im unverändert sichtbaren Elternkontext
- **AND** wird kein zusätzlicher Erfolgstoast angezeigt

#### Scenario: Create ist Teil eines mehrstufigen Setup-Flows

- **WHEN** ein erfolgreich erzeugter Datensatz im aktuellen Create-Kontext noch eine konkrete Einrichtungsentscheidung oder Provisionierungsanleitung benötigt
- **THEN** darf der Flow in diesem sichtbaren Setup-Kontext verbleiben
- **AND** bildet der gemeinsame Save-Button den abgeschlossenen Create-Lifecycle ab

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

### Requirement: Jobstart bleibt im auslösenden Fachkontext nachvollziehbar

Das System MUST nach erfolgreicher Annahme eines Plugin-Operations-Jobs im auslösenden Bereich mindestens die stabile Job-ID, den initialen Hoststatus und einen Weg zum dauerhaften Jobdetail oder Monitoring-Kontext darstellen.

#### Scenario: Plugin-Job wird angenommen

- **WHEN** ein Host-Endpunkt einen Plugin-Operations-Job erfolgreich annimmt
- **THEN** zeigt der auslösende Bereich die Job-ID und den initialen Status
- **AND** bietet einen Weg zum dauerhaften Jobkontext
- **AND** ist ein flüchtiger Start-Toast nicht die einzige Rückmeldung

### Requirement: Jobfeedback verwendet den zentralen Hoststatus

Das System MUST Queue-, Lauf-, Retry-, Erfolgs-, Fehler- und Cancel-Zustände aus dem zentralen Plugin-Operations-Jobdatensatz ableiten.

#### Scenario: Aktiver Job meldet Fortschritt

- **WHEN** ein aktiver Job Status oder Progress aktualisiert
- **THEN** lesen Fachkurzsicht und Jobdetail denselben Hostvertrag
- **AND** erzeugt das Plugin keinen konkurrierenden fachlichen Jobstatus im Client

#### Scenario: Seite wird neu geladen

- **WHEN** der Benutzer den Fachbereich oder das Jobdetail neu lädt
- **THEN** rekonstruiert die UI den aktuellen Zustand über die stabile Job-ID aus dem Hoststore
- **AND** geht die Nachvollziehbarkeit nicht mit lokalem React-State verloren

### Requirement: Terminalzustände bleiben dauerhaft sichtbar

Das System MUST erfolgreiche, fehlgeschlagene und abgebrochene Jobs im Jobdetail und in der Monitoring-Historie dauerhaft nachvollziehbar halten.

#### Scenario: Job wird erfolgreich abgeschlossen

- **WHEN** ein Job in `succeeded` wechselt
- **THEN** zeigen Jobdetail und Historie den Terminalstatus und verfügbare Ergebnisaktionen
- **AND** hängt der Erfolgsnachweis nicht von einer kurzlebigen globalen Meldung ab

#### Scenario: Job schlägt fehl

- **WHEN** ein Job in `failed` wechselt
- **THEN** bleiben Fehlerstatus, sichere Diagnose und verfügbare Folgeaktionen im dauerhaften Kontext sichtbar
- **AND** verschwindet der Fehler nicht automatisch

### Requirement: Jobfolgeaktionen sind Host-Capabilities

Das System MUST Retry, Cancel, Ergebnisöffnung oder Download nur darstellen, wenn Hostvertrag, Berechtigung und aktueller Jobzustand die konkrete Aktion erlauben.

#### Scenario: Fehlgeschlagener Job unterstützt Retry

- **WHEN** der Hostvertrag für einen fehlgeschlagenen Job einen autorisierten Retry erlaubt
- **THEN** darf die UI die Aktion anbieten
- **AND** bleibt die neue oder wiederholte Ausführung über den Hostvertrag und die Jobhistorie nachvollziehbar

#### Scenario: Job unterstützt keinen Retry

- **WHEN** kein sicherer Retry-Vertrag existiert
- **THEN** bietet die UI keinen generischen Retry an
- **AND** beschreibt sie stattdessen die nächste sichere Handlung

### Requirement: Jobfortschritt bleibt zugänglich und begrenzt angekündigt

Das System MUST bedeutende Status- oder Phasenwechsel zugänglich ankündigen, ohne jede Progress-Aktualisierung als Live-Region-Meldung auszugeben oder den Fokus zu verschieben.

#### Scenario: Job meldet viele Fortschrittswerte

- **WHEN** ein laufender Job häufige numerische Progress-Updates liefert
- **THEN** aktualisiert die UI die sichtbare Progressdarstellung
- **AND** kündigt die Live-Region nur nach der festgelegten Drosselungs- oder Phasenregel an
- **AND** verschiebt sie den Fokus nicht automatisch
