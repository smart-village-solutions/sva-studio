## ADDED Requirements

### Requirement: Öffentliche Kalenderaktionen bewahren einen konsistenten lokalen Zustand

Das System SHALL Standortkopf, Fraktionsfilter, Kalenderansichten und globale Aktionen aus demselben vollständig aufgelösten Standortkontext ableiten. Die interne Trennung von Zustand und Darstellung SHALL dabei sichtbares Verhalten, URLs und Accessibility-Verknüpfungen unverändert lassen.

#### Scenario: Standortwechsel setzt den Action-Kontext vollständig zurück

- **WHEN** ein vollständig aufgelöster Standort durch einen anderen Standort ersetzt wird
- **THEN** schließt die App das geöffnete Aktionspanel
- **AND** setzt E-Mail-Adresse, Datenschutz-Einwilligung sowie Reminder-Erfolg und -Fehler zurück
- **AND** leitet Fraktionen und PDF-Zustand aus dem neuen Standortkontext ab

#### Scenario: Fraktionswechsel erhält Formulareingaben

- **WHEN** Benutzerinnen oder Benutzer bei geöffnetem E-Mail-Panel die aktive Fraktionsauswahl ändern
- **THEN** entfernt die App vorheriges Reminder-Erfolgs- oder Fehlerfeedback
- **AND** erhält E-Mail-Adresse, Datenschutz-Einwilligung und geöffnetes Panel
- **AND** berechnet Kalenderexport und E-Mail-Slots erneut aus den aktiven Fraktionen

#### Scenario: Aktionspanels bleiben eindeutig und barrierearm verknüpft

- **WHEN** ein globaler Action-Trigger geöffnet, gewechselt oder erneut aktiviert wird
- **THEN** ist höchstens ein Panel gleichzeitig geöffnet
- **AND** `aria-expanded`, `aria-controls` und `aria-labelledby` beschreiben denselben Zustand
- **AND** Erfolgs- und Fehlermeldungen bleiben als passende Live-Regionen verfügbar

#### Scenario: Laufende E-Mail-Anfrage wird nicht doppelt ausgelöst

- **WHEN** eine gültige E-Mail-Erinnerungsanfrage bereits verarbeitet wird
- **THEN** deaktiviert die App die erneute Übermittlung
- **AND** erzeugt sie aus wiederholter Aktivierung keinen zweiten Request
