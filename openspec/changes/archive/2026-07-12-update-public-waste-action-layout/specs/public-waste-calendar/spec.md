## MODIFIED Requirements
### Requirement: Öffentliche App erlaubt Fraktionsfilter auf geladenen Kalenderdaten

Das System SHALL Benutzerinnen und Benutzern erlauben, die sichtbaren Abfallarten nach dem Laden des Kalenders in einem eigenständigen Kontextblock der vollständigen Standortansicht zu filtern.

#### Scenario: Fraktionsfilter erscheint rechts neben der Adresse

- **WHEN** der Standort vollständig aufgelöst ist
- **THEN** zeigt die App die Adresse links und die auswählbaren Abfallfraktionen als vertikale Liste rechts daneben
- **AND** Änderungen an den Fraktionen wirken auf Kalenderdarstellungen und globale Aktionen aus demselben geladenen Kalenderzustand
- **AND** die Standortauswahl muss nicht erneut durchlaufen werden

### Requirement: Öffentliche App liefert PDF- und iCal-Aktionen konsistent zum Standort

Das System SHALL globale PDF-, iCal- und Erinnerungsaktionen aus demselben finalen Standortkontext und aus derselben aktiven Fraktionsauswahl ableiten wie die Kalenderansicht.

#### Scenario: Aktionen erscheinen in einem gemeinsamen horizontalen Block

- **WHEN** der Standort vollständig aufgelöst ist
- **THEN** zeigt die App unter Adresse und Fraktionsliste einen horizontalen Block mit den Aktionen `Kalenderexport`, `PDF-Download` und `E-Mail-Abo`
- **AND** genau ein zugehöriges Optionspanel ist gleichzeitig geöffnet
- **AND** ein erneuter Klick auf die aktive Aktion schließt deren Panel wieder

#### Scenario: PDF-Aktion erzeugt das Dokument ad hoc in der öffentlichen Runtime

- **WHEN** Benutzerinnen oder Benutzer das Panel `PDF-Download` öffnen
- **THEN** können sie dort das Jahr wählen und den Download für die aktuell aktiven Fraktionen auslösen
- **AND** die öffentliche Runtime erzeugt das PDF serverseitig ad hoc
- **AND** es wird kein persistentes PDF-Artefakt gespeichert

#### Scenario: iCal-Feed nutzt verfügbare Standard-Reminder ohne zusätzliche Abfrage

- **WHEN** Benutzerinnen oder Benutzer das Panel `Kalenderexport` öffnen
- **THEN** können sie den Export für die aktuell aktiven Fraktionen direkt auslösen, ohne zuvor Reminder-Slots auswählen zu müssen
- **AND** die App übernimmt verfügbare kalenderfähige Standard-Reminder automatisch
- **AND** der serverseitig erzeugte iCal-Feed bleibt konsistent zu den in der App sichtbaren Kalenderdaten

#### Scenario: Gemischte Fraktionsauswahl ohne gemeinsame Reminder-Fähigkeit bleibt fail-closed

- **WHEN** die aktuell aktiven Fraktionen nicht für alle gewählten Fraktionen gültige kalender- oder e-mailfähige Reminder-Slots besitzen
- **THEN** zeigt die App eine klare Hinweisnachricht im jeweiligen Aktionspanel
- **AND** sie erzeugt keinen impliziten Reminder-Fallback
- **AND** Nutzerinnen und Nutzer können die Fraktionsauswahl anpassen, um wieder gültige Reminder-Optionen zu erhalten

### Requirement: Öffentliche App bietet einen E-Mail-Erinnerungseinstieg im finalen Standortkontext

Das System SHALL das öffentliche E-Mail-Abo im gemeinsamen Aktionsmodell bereitstellen und dabei die aktive Fraktionsauswahl als führende Quelle verwenden.

#### Scenario: E-Mail-Abo nutzt aktive Fraktionen statt eigener Fraktionsauswahl

- **WHEN** Benutzerinnen oder Benutzer das Panel `E-Mail-Abo` öffnen
- **THEN** zeigt die App nur Felder für E-Mail-Adresse und Datenschutz-Einwilligung der aktuell aktiven Fraktionen
- **AND** verfügbare Reminder-Slots der aktiven Fraktionen werden automatisch mit ihren Standardwerten verwendet
- **AND** das Panel enthält keine zweite, davon getrennte Fraktionsauswahl
- **AND** Erfolgs- und Fehlerzustände bleiben innerhalb desselben Aktionspanels sichtbar
