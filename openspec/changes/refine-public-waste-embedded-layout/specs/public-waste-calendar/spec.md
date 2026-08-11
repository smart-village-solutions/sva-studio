## ADDED Requirements

### Requirement: Öffentliche App zeigt verfügbare Standortoptionen unmittelbar

Das System SHALL in jedem noch offenen Schritt der Standortauswahl alle verfügbaren Optionen bereits vor einer Texteingabe anzeigen und die sichtbare Liste bei einer Eingabe nach dem Suchtext filtern.

#### Scenario: Auswahloptionen sind ohne Suchtext vollständig sichtbar

- **WHEN** ein Standortauswahlschritt mehrere verfügbare Optionen enthält
- **THEN** zeigt die App alle Optionen unmittelbar in einer scrollbar begrenzten Liste
- **AND** verlangt sie keine vorherige Texteingabe
- **AND** kennzeichnet sie sichtbar, wenn unterhalb des aktuellen Ausschnitts weitere Optionen vorhanden sind
- **AND** filtert sie die Liste nach einer Eingabe auf passende Optionen

## MODIFIED Requirements

### Requirement: Öffentliche App erlaubt Fraktionsfilter auf geladenen Kalenderdaten

Das System SHALL Benutzerinnen und Benutzern erlauben, die sichtbaren Abfallarten nach dem Laden des Kalenders in einem eigenständigen Kontextbereich der vollständigen Standortansicht zu filtern.

#### Scenario: Standortaktion und Fraktionsfilter bilden einen flachen Kontextbereich

- **WHEN** der Standort vollständig aufgelöst ist
- **THEN** zeigt die App die Änderungsaktion unmittelbar bei der dargestellten Adresse
- **AND** zeigt die auswählbaren Abfallfraktionen darunter als kompakte, umbrechende Auswahl statt als verschachtelte Karten
- **AND** stellt sie die Auswirkung der Fraktionsauswahl über ein Info-Popover unmittelbar an der Überschrift bereit
- **AND** Änderungen an den Fraktionen wirken auf Kalenderdarstellungen und globale Aktionen aus demselben geladenen Kalenderzustand
- **AND** die Standortauswahl muss nicht erneut durchlaufen werden

### Requirement: Öffentliche App liefert PDF- und iCal-Aktionen konsistent zum Standort

Das System SHALL globale PDF-, iCal- und Erinnerungsaktionen aus demselben finalen Standortkontext und aus derselben aktiven Fraktionsauswahl ableiten wie die Kalenderansicht.

#### Scenario: Werkzeuge erscheinen als eigenständige Disclosure-Aktionen

- **WHEN** der Standort vollständig aufgelöst ist
- **THEN** zeigt die App unter Adresse und Fraktionsauswahl die Aktionen `Kalender exportieren`, `PDF / Druckversion` und `E-Mail-Erinnerung` als kompakte Aktionsleiste
- **AND** die Aktionen verwenden Button- und Disclosure-Semantik statt Tab-Semantik
- **AND** genau ein zugehöriger Optionsbereich ist gleichzeitig geöffnet
- **AND** ein erneuter Klick auf die aktive Aktion schließt deren Optionsbereich wieder

#### Scenario: PDF-Aktion erzeugt das Dokument ad hoc in der öffentlichen Runtime

- **WHEN** Benutzerinnen oder Benutzer den Optionsbereich `PDF / Druckversion` öffnen
- **THEN** können sie dort das Jahr wählen und den Download für die aktuell aktiven Fraktionen auslösen
- **AND** die öffentliche Runtime erzeugt das PDF serverseitig ad hoc
- **AND** es wird kein persistentes PDF-Artefakt gespeichert

#### Scenario: iCal-Feed nutzt verfügbare Standard-Reminder ohne zusätzliche Abfrage

- **WHEN** Benutzerinnen oder Benutzer den Optionsbereich `Kalender exportieren` öffnen
- **THEN** können sie den Export für die aktuell aktiven Fraktionen direkt auslösen, ohne zuvor Reminder-Slots auswählen zu müssen
- **AND** die App übernimmt verfügbare kalenderfähige Standard-Reminder automatisch
- **AND** der serverseitig erzeugte iCal-Feed bleibt konsistent zu den in der App sichtbaren Kalenderdaten

#### Scenario: Gemischte Fraktionsauswahl ohne gemeinsame Reminder-Fähigkeit bleibt fail-closed

- **WHEN** die aktuell aktiven Fraktionen nicht für alle gewählten Fraktionen gültige kalender- oder e-mailfähige Reminder-Slots besitzen
- **THEN** zeigt die App eine klare Hinweisnachricht im jeweiligen Optionsbereich
- **AND** sie erzeugt keinen impliziten Reminder-Fallback
- **AND** Nutzerinnen und Nutzer können die Fraktionsauswahl anpassen, um wieder gültige Reminder-Optionen zu erhalten

### Requirement: Öffentliche App ist für eingebettete Nutzung barrierearm und schlicht

Das System SHALL die öffentliche Abfallkalender-App als reduzierte, iFrame-taugliche und barrierearme Oberfläche bereitstellen.

#### Scenario: Öffentliche App fügt sich als neutraler Inhaltsbereich ein

- **WHEN** die öffentliche App eigenständig oder in einem iFrame dargestellt wird
- **THEN** bleibt ihr äußerer Hintergrund transparent und ohne eigenen Kartenrahmen
- **AND** gliedert sie Inhaltsbereiche vorrangig mit Abstand und dezenten Trennlinien
- **AND** beschränkt sie Radien, Rahmen, Flächen und Schatten auf funktional notwendige Bedienelemente
- **AND** verwendet sie für allgemeine Bedienelemente ausschließlich neutrale Oberflächen und reserviert konfigurierte Farben für fachliche Abfallfraktionen
- **AND** hängt sie nicht von der Studio-Plugin-Oberfläche als UI-Basis ab

#### Scenario: Auswahlfluss und Kalender erfüllen Accessibility-Mindestanforderungen

- **WHEN** Benutzerinnen oder Benutzer die öffentliche App mit Tastatur oder Screenreader bedienen
- **THEN** sind Auswahlfluss, Fraktionsfilter, Kalendernavigation, globale Aktionen und Modal grundsätzlich zugänglich
- **AND** die Capability zielt mindestens auf WCAG 2.1 AA

#### Scenario: Standortauswahl ist ohne Maus effizient bedienbar

- **WHEN** Benutzerinnen oder Benutzer eine Standortoption mit der Tastatur auswählen
- **THEN** exponiert das Suchfeld seine Ergebnisliste als Combobox mit zugehöriger Listbox
- **AND** lassen sich Optionen mit Pfeiltasten, Pos1, Ende und Eingabetaste ansteuern und übernehmen
- **AND** bleiben die einzelnen Optionen außerhalb der regulären Tab-Reihenfolge
- **AND** werden Trefferzahl, Ladezustände sowie Erfolgs- und Fehlermeldungen für assistive Technologien angekündigt

#### Scenario: Kalenderansichten führen den Tastaturfokus mit

- **WHEN** Benutzerinnen oder Benutzer in der Ansichtsleiste Pfeiltasten, Pos1 oder Ende verwenden
- **THEN** wechseln Auswahl und Tastaturfokus gemeinsam auf die entsprechende Ansicht
- **AND** bleibt immer genau ein Tab in der regulären Tab-Reihenfolge

#### Scenario: Automatisierte Accessibility-Prüfung bleibt grün

- **WHEN** die Browser-End-to-End-Tests Auswahlfluss, Kalender und Termindialog rendern
- **THEN** meldet Axe für WCAG 2.0 A/AA, WCAG 2.1 AA und WCAG 2.2 AA keine automatisch erkennbaren Verstöße
