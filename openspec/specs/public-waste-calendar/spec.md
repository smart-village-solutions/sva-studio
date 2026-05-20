# public-waste-calendar Specification

## Purpose
TBD - created by archiving change add-public-waste-calendar-web-app. Update Purpose after archive.
## Requirements
### Requirement: Öffentliche Abfallkalender-App ist eine eigenständige Capability

Das System SHALL eine eigenständige Capability `public-waste-calendar` für die öffentliche Ausspielung des Abfallkalenders bereitstellen.

#### Scenario: Öffentliche Nutzung ist von der Admin-Capability getrennt

- **WHEN** Bürgerinnen, Bürger oder eingebettete Webseiten den Abfallkalender aufrufen
- **THEN** verwenden sie eine eigenständige öffentliche Web-App außerhalb des Studio-Plugins
- **AND** diese Capability ist fachlich von der administrativen Capability `waste-management` getrennt
- **AND** die öffentliche App benötigt keinen Studio-Login

### Requirement: Öffentliche App kapselt Datenquelle serverseitig

Das System SHALL die Konfiguration und den Zugriff auf die Waste-Datenquelle für die öffentliche App vollständig serverseitig kapseln.

#### Scenario: Browser erhält keine direkten Waste-Zugangsdaten

- **WHEN** die öffentliche App Kalenderdaten, Standortoptionen oder Exportinformationen lädt
- **THEN** spricht der Browser ausschließlich öffentliche Read-Verträge der App an
- **AND** die lokale JSON-Konfiguration wird nur serverseitig geladen
- **AND** Datenbank-Credentials oder vergleichbare Geheimnisse werden nicht an den Browser ausgeliefert

#### Scenario: Öffentliche App nutzt dieselbe Waste-Supabase wie die Admin-Pflege

- **WHEN** die öffentliche App Daten für Standortauflösung oder Kalenderanzeige liest
- **THEN** greift sie auf dieselbe Waste-Supabase zu wie das administrative Waste-Management
- **AND** die öffentliche Capability führt keine zweite fachliche Primärquelle für dieselben Kalenderdaten ein

### Requirement: Öffentliche App unterstützt einen datengetriebenen Standortauswahlfluss

Das System SHALL die Auswahl eines Abholorts über einen datengetriebenen mehrstufigen Auswahlfluss bereitstellen.

#### Scenario: Auswahl startet bei mehreren Regionen mit der Region

- **WHEN** in der aktiven Waste-Datenquelle mehr als eine Region für die öffentliche Auswahl relevant ist
- **THEN** startet der Auswahlfluss mit der Regionsauswahl
- **AND** ohne Mehrregionenfall beginnt der Fluss direkt bei der Ortsauswahl

#### Scenario: Auswahl endet so früh wie möglich

- **WHEN** nach der Ortsauswahl nur noch ein allgemeiner Straßenkontext wie `Alle Straßen` existiert
- **THEN** gilt die Auswahl als vollständig abgeschlossen
- **AND** es wird keine unnötige weitere Auswahlstufe verlangt

#### Scenario: Straße und Hausnummer werden nur bei echter Differenzierung abgefragt

- **WHEN** mehrere unterscheidbare Straßen oder mehrere Hausnummern beziehungsweise Hausnummerbereiche existieren
- **THEN** fordert die öffentliche App diese Auswahlstufen nacheinander an
- **AND** sie überspringt nicht notwendige Stufen

### Requirement: Kalender wird erst nach vollständiger Standortauflösung geladen

Das System SHALL Kalenderdaten erst dann laden, wenn der Standort vollständig aufgelöst wurde.

#### Scenario: Unvollständige Auswahl lädt keinen Kalender

- **WHEN** Benutzerinnen oder Benutzer sich noch innerhalb des Standortauswahlflusses befinden
- **THEN** lädt die App noch keinen finalen Kalenderdatensatz
- **AND** lädt nur die jeweils nächste zulässige Auswahlstufe nach

#### Scenario: Vollständige Auswahl lädt den Kalender sofort

- **WHEN** der Standort vollständig aufgelöst ist
- **THEN** lädt die App sofort den zugehörigen Kalenderdatensatz
- **AND** zeigt danach Terminliste, Monatskalender, Jahreskalender und globale Aktionen an

### Requirement: Öffentliche App merkt genau einen Standort pro Browser

Das System SHALL genau einen zuletzt gewählten Standort pro Browser für die öffentliche App merken.

#### Scenario: Gültiger gespeicherter Standort wird automatisch wiederhergestellt

- **WHEN** ein Browser einen gültigen gespeicherten Standort für die öffentliche App besitzt
- **THEN** stellt die App diesen Standort beim nächsten Aufruf automatisch wieder her
- **AND** lädt den Kalender sofort
- **AND** zeigt einen Hinweis an, dass die Adresse geändert werden kann

#### Scenario: Ungültiger gespeicherter Standort wird verworfen

- **WHEN** ein gespeicherter Standort nicht mehr auflösbar oder nicht mehr gültig ist
- **THEN** verwirft die App den gespeicherten Wert
- **AND** startet mit dem normalen Auswahlfluss neu
- **AND** zeigt keinen technischen Fehler aufgrund des veralteten Cookies an

### Requirement: Öffentliche App stellt drei Kalenderdarstellungen bereit

Das System SHALL für einen vollständig aufgelösten Standort drei komplementäre Kalenderdarstellungen bereitstellen.

#### Scenario: Terminliste beginnt mit dem nächsten Termin

- **WHEN** der Kalender für einen Standort geladen ist
- **THEN** beginnt die Terminliste mit dem nächsten verfügbaren Termin
- **AND** listet nachfolgende Termine in zeitlich aufsteigender Reihenfolge

#### Scenario: Monats- und Jahresansicht haben ein begrenztes Navigationsfenster

- **WHEN** Benutzerinnen oder Benutzer den Monats- oder Jahreskalender verwenden
- **THEN** startet die Ansicht beim aktuellen Zeitpunkt
- **AND** erlaubt Navigation höchstens ein Jahr in die Vergangenheit und ein Jahr in die Zukunft

#### Scenario: Klick auf einen Termin öffnet ein Detail-Modal

- **WHEN** ein Tag mit Termin in Monats- oder Jahresansicht aktiviert wird
- **THEN** öffnet die App ein Modal mit Termin, Abfallart und optionalen Hinweisen
- **AND** globale Export-Aktionen bleiben außerhalb des Modals verankert

### Requirement: Öffentliche App erlaubt Fraktionsfilter auf geladenen Kalenderdaten

Das System SHALL Benutzerinnen und Benutzern erlauben, die sichtbaren Abfallarten nach dem Laden des Kalenders zu filtern.

#### Scenario: Fraktionsfilter erfordert keine erneute Standortwahl

- **WHEN** Benutzerinnen oder Benutzer die ausgewählten Abfallarten ändern
- **THEN** wirkt der Filter auf den bereits geladenen Kalenderzustand
- **AND** der aufgelöste Standort bleibt unverändert
- **AND** die Standortauswahl muss nicht erneut durchlaufen werden

### Requirement: Öffentliche App liefert PDF- und iCal-Aktionen konsistent zum Standort

Das System SHALL globale PDF- und iCal-Aktionen aus demselben finalen Standortkontext ableiten wie die Kalenderansicht.

#### Scenario: PDF-Aktionen werden jahresbezogen aus einem URL-Schema abgeleitet

- **WHEN** für einen vollständig aufgelösten Standort globale Aktionen angezeigt werden
- **THEN** stellt die App PDF-Links für Vorjahr, aktuelles Jahr und nächstes Jahr bereit
- **AND** leitet diese Links serverseitig aus einem konfigurierten URL-Schema ab
- **AND** die App ist nicht selbst für die PDF-Erzeugung verantwortlich

#### Scenario: iCal-Feed liefert alle verfügbaren künftigen Termine

- **WHEN** ein Benutzer oder ein Kalender-Client den iCal-Link eines vollständig aufgelösten Standorts aufruft
- **THEN** liefert die App einen serverseitig erzeugten iCal-Feed
- **AND** der Feed enthält alle verfügbaren künftigen Termine dieses Standorts
- **AND** der Feed ist konsistent zu den in der App sichtbaren Kalenderdaten

### Requirement: Öffentliche App ist für eingebettete Nutzung barrierearm und schlicht

Das System SHALL die öffentliche Abfallkalender-App als reduzierte, iFrame-taugliche und barrierearme Oberfläche bereitstellen.

#### Scenario: Öffentliche App bleibt ohne Studio-Designsystem verständlich bedienbar

- **WHEN** die öffentliche App eigenständig gestaltet wird
- **THEN** bleibt die Oberfläche visuell schlicht, klar und übersichtlich
- **AND** sie hängt nicht von der Studio-Plugin-Oberfläche als UI-Basis ab

#### Scenario: Auswahlfluss und Kalender erfüllen Accessibility-Mindestanforderungen

- **WHEN** Benutzerinnen oder Benutzer die öffentliche App mit Tastatur oder Screenreader bedienen
- **THEN** sind Auswahlfluss, Fraktionsfilter, Kalendernavigation, globale Aktionen und Modal grundsätzlich zugänglich
- **AND** die Capability zielt mindestens auf WCAG 2.1 AA

