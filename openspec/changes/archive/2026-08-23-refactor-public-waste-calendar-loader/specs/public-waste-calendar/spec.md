## ADDED Requirements

### Requirement: Öffentlicher Kalender-Lader bleibt standortgebunden und deterministisch

Das System SHALL Kalenderdaten ausschließlich für den vollständig aufgelösten
Standort laden und berechnete sowie explizite Termine deterministisch zu demselben
öffentlichen Kalendervertrag zusammenführen.

#### Scenario: Standortfilter gelten identisch für Touren und explizite Einsätze

- **WHEN** die öffentliche Runtime Kalenderdaten für Region, Ort, Straße und optional Hausnummer lädt
- **THEN** verwendet sie für wiederkehrende Touren und explizite Einsätze dieselben parametrisierten Standortgrenzen
- **AND** allgemeine Regions-, Straßen- oder Hausnummerzuordnungen werden nur nach der bestehenden Hierarchiesemantik vererbt
- **AND** Daten anderer Mandantenschemata oder nicht passender Standorte werden nicht als Fallback ausgegeben

#### Scenario: Datumsfenster bleibt Date-only und inklusive

- **WHEN** die öffentliche Runtime einen gültigen Referenztag erhält
- **THEN** reicht das Kalenderfenster vom Jahresanfang des Vorjahres bis einschließlich desselben Tags ein Jahr später
- **AND** ein Zeit- oder Zeitzonenanteil verändert den führenden Date-only-Tag nicht

#### Scenario: Explizite und berechnete Termine werden stabil zusammengeführt

- **WHEN** berechnete Tourtermine und explizite Einsätze geladen wurden
- **THEN** verdrängt ein passender expliziter Einsatz nur den identischen berechneten Tour-, Tages- und Fraktionstermin
- **AND** mehrere explizite Einsätze behalten ihre eigenen IDs
- **AND** das Ergebnis ist zuerst nach Datum und danach nach deutschem Fraktionsnamen sortiert

#### Scenario: Ungültige Eingaben und Datenbankfehler erzeugen keine Ersatzdaten

- **WHEN** der Referenztag ungültig ist oder eine notwendige Datenbankabfrage fehlschlägt
- **THEN** liefert der Loader keine teilweise erzeugten oder mandantenfremden Ersatztermine
- **AND** ein Datenbankfehler bleibt für den bestehenden öffentlichen Fehlervertrag sichtbar

### Requirement: Web- und Exportpfade verwenden dieselbe Kalenderdatenbasis

Das System SHALL Kalenderansicht, PDF und iCal aus derselben standortgebundenen
Repository-Ausgabe ableiten.

#### Scenario: PDF filtert erst nach gemeinsamer Kalenderladung

- **WHEN** ein PDF für ein Jahr und ausgewählte Fraktionen angefordert wird
- **THEN** lädt die Runtime zunächst dieselben wirksamen Standorttermine wie die Webansicht
- **AND** wendet Jahres- und Fraktionsfilter erst auf diese gemeinsame Ausgabe an
