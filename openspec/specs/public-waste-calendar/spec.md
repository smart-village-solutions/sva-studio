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

#### Scenario: Terminliste beginnt mit dem nächsten Termin und trennt Vergangenes separat ab

- **WHEN** der Kalender für einen Standort geladen ist
- **THEN** beginnt die Terminliste mit dem nächsten verfügbaren Termin
- **AND** zeigt danach weitere künftige Termine in zeitlich aufsteigender Reihenfolge
- **AND** sie kann je nach Datenlage auch vergangene Termine bis zum Anfang des Vorjahres enthalten
- **AND** vergangene Termine erscheinen mit einer eigenen Überschrift erst nach dem Block der künftigen Termine

#### Scenario: Monats- und Jahresansicht haben ein begrenztes Navigationsfenster

- **WHEN** Benutzerinnen oder Benutzer den Monats- oder Jahreskalender verwenden
- **THEN** startet die Ansicht beim aktuellen Zeitpunkt
- **AND** erlaubt Navigation rückwärts höchstens bis zum frühesten verfügbaren Monat des Standorts
- **AND** die Rückwärtsnavigation reicht dabei nie vor den Jahresanfang des Vorjahres
- **AND** die Vorwärtsnavigation bleibt höchstens ein Jahr in die Zukunft begrenzt

#### Scenario: Klick auf einen Termin öffnet ein Detail-Modal

- **WHEN** ein Tag mit Termin in Monats- oder Jahresansicht aktiviert wird
- **THEN** öffnet die App ein Modal mit Termin, Abfallart und optionalen Hinweisen
- **AND** globale Export-Aktionen bleiben außerhalb des Modals verankert

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

### Requirement: Öffentliche App bietet einen E-Mail-Erinnerungseinstieg im finalen Standortkontext

Das System SHALL das öffentliche E-Mail-Abo im gemeinsamen Aktionsmodell bereitstellen und dabei die aktive Fraktionsauswahl als führende Quelle verwenden.

#### Scenario: E-Mail-Abo nutzt aktive Fraktionen statt eigener Fraktionsauswahl

- **WHEN** Benutzerinnen oder Benutzer das Panel `E-Mail-Abo` öffnen
- **THEN** zeigt die App nur Felder für E-Mail-Adresse und Datenschutz-Einwilligung der aktuell aktiven Fraktionen
- **AND** verfügbare Reminder-Slots der aktiven Fraktionen werden automatisch mit ihren Standardwerten verwendet
- **AND** das Panel enthält keine zweite, davon getrennte Fraktionsauswahl
- **AND** Erfolgs- und Fehlerzustände bleiben innerhalb desselben Aktionspanels sichtbar

### Requirement: Öffentliche App sammelt E-Mail-Erinnerungen formularbasiert mit fraktionsbezogenen Zeitslots
Das System SHALL die Einrichtung der E-Mail-Erinnerung über ein Formular in derselben öffentlichen App abwickeln.

#### Scenario: Formular bietet nur E-Mail-fähige Fraktionen an
- **WHEN** ein Benutzer die Einrichtung der E-Mail-Erinnerung öffnet
- **THEN** bietet das Formular nur Abfallarten an, deren Reminder-Konfiguration den Kanal `email` aktiviert hat
- **AND** es bietet nur Fraktionen an, die mindestens einen gültigen E-Mail-Slot besitzen

#### Scenario: Standardslots werden pro gewählter Fraktion automatisch verwendet
- **WHEN** ein Benutzer mehrere Abfallarten auswählt
- **THEN** verwendet das Formular für jede gewählte Fraktion deren zulässigen Standard-Slot automatisch
- **AND** unterschiedliche Fraktionen dürfen unterschiedliche Standardslots erhalten
- **AND** das Formular fragt diese Slot-Auswahl nicht zusätzlich ab

#### Scenario: Datenschutz-Einwilligung ist Pflicht
- **WHEN** ein Benutzer das Formular ohne bestätigte Datenschutz-Checkbox absenden will
- **THEN** lehnt das System das Speichern ab
- **AND** zeigt einen verständlichen Validierungshinweis an

### Requirement: Öffentliche App aktiviert E-Mail-Erinnerungen erst nach Double-Opt-In
Das System SHALL den E-Mail-Erinnerungsdienst erst nach bestätigtem Double-Opt-In aktivieren.

#### Scenario: Formular erzeugt nur ein Pending-Abo
- **WHEN** ein Benutzer das Formular mit gültigen Daten absendet
- **THEN** speichert das System zunächst ein Pending-Abo
- **AND** versendet eine Bestätigungs-E-Mail an die angegebene Adresse
- **AND** die UI bestätigt nur den Versand des Bestätigungslinks, nicht die sofortige Aktivierung

#### Scenario: DOI-Bestätigung erfolgt in derselben Public-Waste-App
- **WHEN** ein Benutzer auf den Bestätigungslink aus der DOI-Mail klickt
- **THEN** landet er auf einer Unterseite derselben Public-Waste-App
- **AND** das Pending-Abo wird nur bei gültigem Token in den Status `active` überführt
- **AND** die App bestätigt, dass der E-Mail-Erinnerungsdienst eingerichtet wurde

#### Scenario: Abgelaufene oder ungültige DOI-Tokens bleiben sicher behandelbar
- **WHEN** ein Benutzer einen abgelaufenen, manipulierten oder bereits verbrauchten DOI-Link aufruft
- **THEN** aktiviert das System kein Abo
- **AND** die App zeigt eine verständliche Fehlseite ohne technische Interna

### Requirement: Jede Erinnerungs-E-Mail enthält eine Abmeldung über dieselbe Public-Waste-App
Das System SHALL jede Erinnerungs-E-Mail mit einem eindeutigen Abmeldelink auf eine Unterseite derselben Public-Waste-App versehen.

#### Scenario: Abmeldelink deaktiviert den Dienst sofort
- **WHEN** ein Benutzer den Abmeldelink aus einer Erinnerungs-E-Mail öffnet
- **THEN** deaktiviert das System das zugehörige Abo ohne zusätzlichen Login
- **AND** die App bestätigt auf einer Unterseite der Public-Waste-App, dass der Dienst deaktiviert wurde
- **AND** nach erfolgreicher Abmeldung werden keine weiteren Erinnerungs-E-Mails mehr versendet

#### Scenario: Abmeldelink ist idempotent
- **WHEN** ein Benutzer denselben Abmeldelink mehrfach aufruft
- **THEN** bleibt das Abo deaktiviert
- **AND** die App zeigt weiterhin einen stabilen Bestätigungszustand statt eines technischen Fehlers

### Requirement: Erinnerungsversand berücksichtigt Fraktion und Slot als eigenständige Versandereignisse
Das System SHALL Erinnerungen pro gewählter Fraktion und pro gewähltem Slot eigenständig auslösen.

#### Scenario: Mehrere Fraktionen am selben Tag erzeugen mehrere E-Mails
- **WHEN** für denselben Abholtag mehrere abonnierte Fraktionen mit unterschiedlichen gewählten E-Mail-Slots anstehen
- **THEN** versendet das System mehrere Erinnerungs-E-Mails statt einer Sammelmail
- **AND** jede E-Mail bezieht sich auf die betroffene Fraktion und deren wirksames Zeitfenster

#### Scenario: Deduplizierung verhindert doppelte Einzelmails
- **WHEN** derselbe Reminder für dieselbe Subscription, Fraktion, Slot-Kombination und denselben Abholtag erneut materialisiert würde
- **THEN** versendet das System keine zweite identische E-Mail
- **AND** der Versandvertrag bleibt idempotent

### Requirement: Öffentliche App und Waste-Backend delegieren den technischen Mail-Transport an eine zentrale Interface-Anbindung
Das System SHALL den technischen Versand von DOI- und Reminder-E-Mails über eine zentrale Mail-Transport-Schnittstelle aus `interfaces` ausführen.

#### Scenario: Öffentliche Formular- und DOI-Flows versenden nicht direkt per SMTP
- **WHEN** das öffentliche Formular ein Pending-Abo speichert oder eine DOI-Bestätigung beziehungsweise Reminder-Auslösung ansteht
- **THEN** erzeugt die Waste-Laufzeit nur einen normalisierten Versandauftrag oder ein entsprechendes Ereignis
- **AND** die technische Zustellung erfolgt über die zentrale Mail-Transport-Schnittstelle aus `interfaces`
- **AND** die Public-Waste-App hält keine SMTP- oder Provider-Credentials

### Requirement: Waste materialisiert Reminder ressourcenschonend über eine Outbox
Das System SHALL fällige DOI- und Reminder-Sendungen ressourcenschonend über eine inkrementell befüllte Outbox statt über regelmäßige Vollscans aller Abos abwickeln.

#### Scenario: Neue oder geänderte Fachereignisse erzeugen gezielt Versandaufträge
- **WHEN** ein Abo aktiviert wird, Waste-Termine geändert werden oder fraktionsbezogene Reminder-Slots angepasst werden
- **THEN** materialisiert die Waste-Laufzeit gezielt nur die betroffenen Versandaufträge
- **AND** sie schreibt diese mit geplantem Versandzeitpunkt in eine Outbox
- **AND** sie berechnet nicht zyklisch alle aktiven Abos vollständig neu

#### Scenario: Mail-App verarbeitet nur fällige Outbox-Einträge
- **WHEN** die zentrale Mail-Transport-Laufzeit Sendungen abarbeitet
- **THEN** liest sie nur Outbox-Einträge mit fälligem Versandzeitpunkt und geeignetem Status
- **AND** sie verarbeitet diese in kleinen Batches
- **AND** die Architektur reduziert dadurch Lastspitzen auf Waste-Datenbank und Mail-Provider

### Requirement: Öffentliche App exportiert PDFs mit Jahres- und Fraktionswahl

Das System SHALL PDF-Exporte serverseitig aus dem vollständig aufgelösten Standort, dem gewählten Jahr und den ausgewählten Fraktionen erzeugen.

#### Scenario: Export berücksichtigt nur die Auswahl des Benutzers

- **WHEN** Benutzerinnen oder Benutzer ein Jahr und mindestens eine Fraktion für den Export wählen
- **THEN** enthält das PDF nur Termine des gewählten Jahres
- **AND** nur Termine der ausgewählten Fraktionen werden in den Export aufgenommen

### Requirement: Öffentliche App berücksichtigt übergeordnete Abholorte im PDF-Export

Das System SHALL beim PDF-Export alle wirksamen Termine des Standortkontexts einschließlich übergeordneter Abholorte berücksichtigen.

#### Scenario: Ortsebene vererbt Termine an konkrete Straßen

- **WHEN** ein konkreter Standort wie `Perleberg, Ackerstraße` exportiert wird
- **AND** eine Tour nur dem übergeordneten Abholort `Perleberg (alle Straßen)` zugeordnet ist
- **THEN** wird diese Tour trotzdem in den PDF-Export aufgenommen
- **AND** erst danach greifen Jahres- und Fraktionsfilter

### Requirement: Öffentliche Abfallkalender-App hat einen isolierten Releasepfad

Das System SHALL für `web-waste-calendar` einen eigenen Releasepfad
bereitstellen, der weder den `studio`-Stack noch den `studio`-Releaseworkflow
mitverwendet.

#### Scenario: Git-Tag triggert nur den öffentlichen Waste-Release

- **WHEN** ein Git-Tag `waste-web-v1.2.3` gepusht wird
- **THEN** baut und deployt das System nur die öffentliche Waste-Web-Runtime
- **AND** der normale Studio-Releasepfad bleibt unberührt

#### Scenario: Öffentliche Waste-Runtime nutzt eigenen Variablenraum

- **WHEN** die öffentliche Waste-Web-Runtime produktiv gestartet wird
- **THEN** liest sie ihre führende Konfiguration aus `PUBLIC_WASTE_*`-Variablen
- **AND** greift nicht implizit auf `SVA_*`-Runtime-Variablen des normalen Studios zurück
- **AND** ein JSON-basierter Konfigurationsblob bleibt höchstens ein lokaler oder kompatibler Fallback

### Requirement: Öffentliche Abfallkalender-App liefert produktiven Health- und API-Vertrag

Das System SHALL die öffentliche Waste-Web-App produktiv als eigene
serverseitige Runtime mit statischen Assets, Health-Endpoint und bestehenden
öffentlichen Read-Endpunkten ausliefern.

#### Scenario: Produktionsruntime antwortet auf Health-Check

- **WHEN** ein Operator oder Releaseworkflow `GET /health/live` gegen die öffentliche Waste-Web-Runtime ausführt
- **THEN** liefert die Runtime einen expliziten erfolgreichen Health-Befund
- **AND** dieser Befund ist unabhängig vom normalen Studio-Health-Pfad

#### Scenario: Produktiver Release prüft einen öffentlichen Read-Pfad

- **WHEN** ein Release der öffentlichen Waste-Web-Runtime abgeschlossen wird
- **THEN** prüft der Smoke-Test neben der Startseite mindestens einen öffentlichen `/api/public-waste/*`-Pfad
- **AND** bewertet damit nicht nur das Vorhandensein eines laufenden Containers, sondern den fachlichen Read-Vertrag
