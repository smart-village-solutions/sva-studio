## ADDED Requirements

### Requirement: Stellenanzeigen besitzen eine fachliche Redaktion

Das System MUST Stellenanzeigen vom Typ `jobs.job` auf einer Seite anlegen und über die bestehenden Detailmuster mit Basis, Inhalt und Studio-Historie bearbeiten können. Titel, Anstellungsart, Veröffentlichungsdatum und Ablaufdatum MUST für einen gültigen Save vorhanden sein. Inhalt, externe ID, Medien, Arbeitgeber und Ansprechpartner MUST optional sein; ein Arbeitgeber mit weiteren Angaben MUST einen Namen besitzen.

#### Scenario: Neue Stellenanzeige wird ausgeblendet angelegt

- **WHEN** eine berechtigte Person eine Stellenanzeige anlegt
- **THEN** sind Veröffentlichung mit heute und Ablauf mit heute plus 28 Kalendertagen vorbelegt
- **AND** bleibt die neue Anzeige bis zu einer ausdrücklich autorisierten Sichtbarkeitsänderung ausgeblendet
- **AND** speichert die Anlage getrennte Arbeitgeber- und Ansprechpartnerdaten über den bestehenden Mainserver-Vertrag

#### Scenario: Bestehende Anzeige erhält zusätzliche Einträge

- **GIVEN** eine bestehende Anzeige enthält mehrere Firmen, Kontakte, Textblöcke, Dateien oder Datumsmetadaten
- **WHEN** die Person nur Titel oder primäre Angaben ändert
- **THEN** bleiben nicht bearbeitete Einträge samt Metadaten und Reihenfolge erhalten und zugänglich
- **AND** ersetzt das Formular fehlende Bestandsdaten nicht durch heutige Defaults

#### Scenario: Fehlerhafte Eingaben bleiben korrigierbar

- **WHEN** Pflichtangaben fehlen, der Ablauf vor der Veröffentlichung liegt oder eine angegebene Firma keinen Namen besitzt
- **THEN** verhindern Client und Server das Speichern
- **AND** benennt die übersetzte Oberfläche die betroffenen Felder und führt den Fokus zum ersten fehlerhaften Feld
- **AND** bleiben die übrigen Eingaben erhalten

### Requirement: Anstellungsarten verwenden den bestehenden Kategorienamenvertrag

Das System MUST ausschließlich aktive Kategorien mit exakt dem Tag `generic_item_job` als neue Anstellungsarten anbieten und den gewählten Namen unter `payload.employmentType` speichern. Eine Auswahl MUST keine allgemeine Kategoriezuordnung erzeugen. Ein unveränderter nicht mehr angebotener Bestandsstring MUST erhalten bleiben können.

#### Scenario: Neu gewählte Anstellungsart ist kompatibel

- **WHEN** eine Person eine Anstellungsart auswählt
- **THEN** prüfen Client und Server sie gegen den berechtigten aktuellen Job-Lookup
- **AND** sind ungetaggte Kategorien und bloße Teiltreffer ausgeschlossen
- **AND** wird ihr Name als String und keine Kategorie-ID gespeichert

#### Scenario: Entfernter Auswahlwert bleibt beim Titelupdate erhalten

- **GIVEN** der vorhandene String ist nicht mehr als aktive Anstellungsart verfügbar
- **WHEN** ausschließlich der Titel geändert wird
- **THEN** zeigt der Editor den Bestandswert an und erhält ihn unverändert
- **AND** wird er nicht automatisch durch einen anderen oder leeren Wert ersetzt

#### Scenario: Fehlende Auswahl ist kein verdeckter Ladefehler

- **WHEN** der Lookup keine zulässigen Werte liefert oder technisch fehlschlägt
- **THEN** unterscheidet die Oberfläche leere Auswahl und Ladefehler
- **AND** bleibt eine Neuanlage ohne Anstellungsart ungespeichert und verständlich korrigierbar

### Requirement: Die Stellenübersicht filtert vor der Seiteneinteilung

Das System MUST Stellenanzeigen in der gemeinsamen Inhaltsübersicht mit Titel, primärem Arbeitgeber, Anstellungsart, Veröffentlichung, Ablauf, Sichtbarkeit und letzter Änderung anzeigen. Titelsuche sowie Anstellungsart-, Sichtbarkeits- und Laufzeitfilter MUST vor Gesamtzahl und Paginierung auf den vollständigen berechtigten Bestand wirken.

#### Scenario: Filter und Seitenwechsel bleiben konsistent

- **WHEN** ein Filter geändert oder die Seitengröße gewählt wird
- **THEN** beginnt die Liste auf Seite 1 und behält die übrigen Filter
- **AND** bleiben die Filter beim folgenden Seitenwechsel erhalten
- **AND** erscheinen leere Treffer, Ladefehler und erreichte Scan-Grenzen als unterschiedliche Zustände

### Requirement: Laufzeit und Sichtbarkeit sind unabhängige Angaben

Das System MUST Veröffentlichung und Ablauf als Kalenderdaten behandeln und von der ausdrücklich autorisierten Sichtbarkeit trennen. Ein Ablaufdatum MUST in diesem Lieferumfang keine automatische Veröffentlichung, Ausblendung, Archivierung oder Löschung auslösen.

#### Scenario: Datum erzeugt keine implizite Veröffentlichung

- **WHEN** eine ausgeblendete Anzeige ihr Veröffentlichungsdatum erreicht oder ihr Datum geändert wird
- **THEN** bleibt ihre Sichtbarkeit unverändert
- **AND** erzeugt die zeitliche Einordnung der Liste keine Mutation

#### Scenario: Bewusst gesetzter Ablauf bleibt erhalten

- **GIVEN** eine Person hat ein Ablaufdatum gewählt
- **WHEN** sie das Veröffentlichungsdatum ändert
- **THEN** bleibt das gewählte Ablaufdatum erhalten
- **AND** verlangt ein daraus entstehender ungültiger Zeitraum eine ausdrückliche Korrektur

### Requirement: Stellenanzeigen verwenden gemeinsame Medien und zugängliche Formulare

Das System MUST vorhandene Studio-Medien-/Rich-Text-/Formularlösungen, de/en-Übersetzungen und WCAG-2.1-AA-konforme Bedienung verwenden. Medienverwendungen MUST ihre Reihenfolge und Metadaten erhalten; vorläufige oder nicht berechtigt nutzbare Medien MUST vor dem Content-Write abgewiesen werden.

#### Scenario: Medienfehler verliert keinen Entwurf

- **WHEN** ein Upload oder eine Medienauswahl fehlschlägt
- **THEN** erscheint der Fehler im tatsächlich geöffneten Dialogzustand
- **AND** bleiben Formulareingaben erhalten
- **AND** verändert die Auswahl keine zentralen Medienmetadaten ohne die dafür bestehende ausdrückliche Aktion und Berechtigung

### Requirement: Endgültiges Löschen verlangt eine konkrete Bestätigung

Das System MUST endgültiges Löschen nur mit `jobs.delete` und einer Bestätigung der konkreten Anzeige anbieten. Das Entfernen einer Medienverwendung MUST nicht automatisch das zentrale Medienasset löschen.

#### Scenario: Abgebrochene Löschung verändert keinen Bestand

- **WHEN** eine berechtigte Person den mit Titel und Löschwirkung angezeigten Bestätigungsdialog abbricht
- **THEN** wird keine Löschmutation gesendet

#### Scenario: Unklarer Löschstatus wird nicht als Erfolg angezeigt

- **WHEN** der Ausgang einer bestätigten Löschung nicht unabhängig nachgewiesen werden kann
- **THEN** zeigt die Oberfläche einen ungeklärten Zustand mit lesender Ergebnisprüfung
- **AND** wiederholt sie die Mutation nicht automatisch
