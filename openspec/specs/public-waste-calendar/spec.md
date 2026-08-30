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

#### Scenario: Öffentliche App nutzt dieselbe PostgreSQL-Waste-Datenbank wie die Admin-Pflege

- **WHEN** die öffentliche App Daten für Standortauflösung oder Kalenderanzeige liest
- **THEN** greift sie auf dieselbe PostgreSQL-Waste-Datenbank zu wie das administrative Waste-Management
- **AND** die öffentliche Capability führt keine zweite fachliche Primärquelle für dieselben Kalenderdaten ein
- **AND** die öffentliche Runtime benötigt keine Supabase-API oder Supabase-Credentials

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

#### Scenario: Terminliste bleibt ohne Detailaktion

- **WHEN** die Terminliste dargestellt wird
- **THEN** erscheinen ihre Termine als statische Listeneinträge ohne Link oder Schaltfläche
- **AND** die Aktivierung eines Listeneintrags öffnet kein Detail-Modal

#### Scenario: Hinweise werden als bereinigtes Rich Text dargestellt

- **WHEN** ein sichtbarer Listenhinweis oder ein Hinweis im Detail-Modal HTML-Auszeichnung enthält
- **THEN** interpretiert die App die erlaubte Rich-Text-Auszeichnung
- **AND** entfernt Skripte, Ereignisattribute und unsichere Linkziele vor der Darstellung

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

#### Scenario: iCal-Beschreibungen enthalten Hinweise als bereinigten Klartext

- **WHEN** Fraktions-, Tour- oder Termin-Hinweise HTML-Auszeichnung enthalten
- **THEN** wandelt der iCal-Export die Hinweise vor der Deduplizierung in strukturierten Klartext um
- **AND** bleiben Absätze, Listen sowie sichere Linkziele in der Terminbeschreibung lesbar
- **AND** enthält das `DESCRIPTION`-Feld weder HTML-Tags noch Skriptinhalt oder unsichere Linkziele

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

### Requirement: Öffentlicher Kalender löst explizite Einsatzorte hierarchisch auf

Das System SHALL einen expliziten Einsatz anzeigen, wenn einer seiner Abholorte dem angefragten Abholort oder einem Vorfahren davon entspricht.

#### Scenario: Ortsebene gilt für konkrete Straße

- **WHEN** ein Einsatz für einen Ort mit allen Straßen hinterlegt ist
- **AND** ein Benutzer eine konkrete Straße dieses Orts abfragt
- **THEN** enthält der Kalender den Einsatz

### Requirement: Öffentlicher Kalender filtert Einsätze über Tour-Fraktionen

Das System SHALL die Abfallfraktionen eines expliziten Einsatzes ausschließlich aus seiner Tour ableiten.

#### Scenario: Schadstoffmobil-Fraktion filtert Einsatz

- **WHEN** eine Tour der Fraktion Schadstoffmobil zugeordnet ist
- **AND** ein Benutzer diese Fraktion auswählt
- **THEN** zeigt der Kalender die expliziten Einsätze dieser Tour

### Requirement: Explizite Einsätze verdrängen doppelte Wiederholungstermine

Das System SHALL einen expliziten Einsatz statt eines sonst identischen berechneten Wiederholungstermins ausgeben.

#### Scenario: Expliziter Einsatz ergänzt regulären Termin

- **WHEN** ein expliziter Einsatz und ein berechneter Termin für dieselbe Tour, denselben Tag und den abgefragten Ort existieren
- **THEN** zeigt der Kalender den expliziten Einsatz nur einmal
- **AND** ein expliziter Hinweis hat Vorrang vor einem allgemeinen Tourhinweis

### Requirement: Öffentliche App liefert einen lesenden Abholortkatalog

Das System SHALL über `GET /api/public-waste/locations` alle aktiven öffentlichen Abholorte als deterministisch sortierte, ausschließlich aus bestehenden Waste-Daten projizierte Liste bereitstellen.

#### Scenario: Verbraucher lädt alle öffentlichen Abholorte

- **WHEN** ein Verbraucher den öffentlichen Abholortkatalog abruft
- **THEN** enthält die Antwort pro eindeutigem Auswahlpfad einen Standortschlüssel sowie die vorhandenen technischen IDs und Originalbezeichnungen
- **AND** identische Auswahlpfade werden deterministisch über den bestehenden Standortschlüssel dedupliziert
- **AND** inaktive Abholorte werden nicht ausgegeben

#### Scenario: Ortskatalog bleibt ein reiner Leseweg

- **WHEN** der Abholortkatalog abgerufen wird
- **THEN** liest das System ausschließlich bestehende Waste-Fachdaten
- **AND** es führt weder Schreibzugriffe noch Backfills, Seeds oder Datenmigrationen aus

### Requirement: Öffentlicher Ortskatalog mappt vorhandene Hierarchie ohne Ersatzwerte

Das System SHALL eine vorhandene Region als `municipality` und einen vorhandenen Ort als `district` mit ihren unveränderten IDs und Originalnamen projizieren.

#### Scenario: Region und Ort sind vorhanden

- **WHEN** ein aktiver Abholort eine Region und einen Ort besitzt
- **THEN** enthält `municipality` die vorhandene Regions-ID und den unveränderten Regionsnamen
- **AND** enthält `district` die vorhandene Orts-ID und den unveränderten Ortsnamen
- **AND** ist `mappingComplete` gleich `true`

#### Scenario: Region fehlt

- **WHEN** ein aktiver Abholort keine Region besitzt
- **THEN** ist `municipality` gleich `null`
- **AND** bleibt der vorhandene Ort unter `district` erhalten
- **AND** ist `mappingComplete` gleich `false`
- **AND** enthält `missingFields` den Wert `municipality`
- **AND** verwendet das System weder den Ort noch einen Defaultwert als künstliche Gemeinde

### Requirement: Öffentlicher Ortskatalog beschreibt vorhandene Auswahlbreite

Das System SHALL konkrete und übergeordnete Abholorte mit der bestehenden öffentlichen Auswahlsemantik für Straße und Hausnummer beschreiben.

#### Scenario: Abholort gilt für alle Straßen eines Orts

- **WHEN** ein aktiver Abholort keine konkrete Straße besitzt
- **THEN** enthält `streetOrCollectionDistrict` die bestehende Auswahl-ID `all`
- **AND** enthält das Feld die bestehende Originalbezeichnung `Alle Straßen`

#### Scenario: Abholort gilt für alle Hausnummern einer Straße

- **WHEN** ein aktiver Abholort eine Straße, aber keine konkrete Hausnummer besitzt
- **THEN** enthält `houseNumber` die bestehende Auswahl-ID `all`
- **AND** enthält das Feld die bestehende Originalbezeichnung `Alle Hausnummern`

### Requirement: Jeder Katalogeintrag ist mit dem bestehenden Kalenderendpunkt nutzbar

Das System SHALL für jeden Katalogeintrag eine `calendarQuery` mit den bestehenden Parametern des öffentlichen Kalenderendpunkts bereitstellen.

#### Scenario: Verbraucher lädt Termine für einen Katalogeintrag

- **WHEN** ein Verbraucher `regionId`, `cityId`, `streetId` und gegebenenfalls `houseNumberId` aus `calendarQuery` an `GET /api/public-waste/calendar` übergibt
- **THEN** verwendet der Kalenderendpunkt unverändert seine bestehende Terminberechnung
- **AND** kann der Verbraucher die Kalenderantwort anhand des Katalogeintrags dem vollständigen Abholort zuordnen

#### Scenario: Katalogeintrag besitzt keine Region

- **WHEN** ein Katalogeintrag keine vorhandene Region besitzt
- **THEN** lässt `calendarQuery` den optionalen Parameter `regionId` aus
- **AND** bleiben die übrigen vorhandenen Auswahlparameter unverändert nutzbar

### Requirement: Öffentlicher Ortskatalog wahrt die bestehende Datenminimierung

Das System SHALL im Abholortkatalog nur aktive, bereits öffentlich auswählbare Adresswerte ausgeben.

#### Scenario: Ortskatalog wird öffentlich abgerufen

- **WHEN** die Public-Waste-Runtime den Ortskatalog beantwortet
- **THEN** enthält die Antwort keine E-Mail-Abonnements, Consent-, Token-, Outbox-, Credential-, Audit- oder Jobdaten
- **AND** verwendet der Endpunkt dieselbe eingeschränkte öffentliche Datenzugriffsgrenze wie die bestehenden Public-Waste-Read-Endpunkte

### Requirement: PDF-Legende zeigt kontextbezogene Hinweise vertikal

Das System SHALL die Legende des PDF-Abfallkalenders direkt unterhalb des Kalenderrasters als vertikale Liste mit höchstens acht einzeiligen Einträgen darstellen.

#### Scenario: Sichtbare Fraktion besitzt eine Beschreibung

- **WHEN** eine im PDF sichtbare Fraktion eine Beschreibung besitzt
- **THEN** zeigt ihre Legendenzeile Farbbox, Kürzel und den Text `<Bezeichnung> - <Beschreibung>` ohne feste Beschreibungsspalte
- **AND** die Beschreibung verwendet den verbleibenden Platz bis zum rechten Seitenrand

#### Scenario: Beschreibung enthält HTML-Auszeichnung

- **WHEN** eine Fraktionsbeschreibung oder ein kontextbezogener Hinweis HTML-Auszeichnung enthält
- **THEN** wandelt die PDF-Ausgabe Absätze, Zeilenumbrüche und Listen in lesbaren Klartext um
- **AND** enthält die PDF-Legende weder HTML-Tags noch Skriptinhalt oder angehängte Linkziele
- **AND** werden HTML-Entities als die zugehörigen Klartextzeichen dargestellt

#### Scenario: Sichtbare Tour oder einzelner Termin besitzt einen Hinweis

- **WHEN** eine Tour mindestens einen sichtbaren PDF-Termin erzeugt oder ein sichtbarer Termin einen eigenen Hinweis besitzt
- **THEN** zeigt die Legende den jeweiligen Tour- beziehungsweise Terminbezug und den Hinweis getrennt durch ` - ` ohne feste Beschreibungsspalte
- **AND** Hinweise nicht sichtbarer Touren oder Termine werden ausgelassen

#### Scenario: Legendentext überschreitet die verfügbare Breite

- **WHEN** ein Legendentext nicht vollständig in seine einzelne Zeile passt
- **THEN** kürzt das System ihn anhand seiner gerenderten Breite
- **AND** der sichtbare Text endet mit `...`
- **AND** es entsteht kein Zeilenumbruch

### Requirement: PDF reserviert Raum für höchstens acht Legendenzeilen

Das System SHALL durch einen kompakteren Kopfbereich und den Wegfall der redundanten Fußzeile Raum für acht Legendenzeilen schaffen, ohne das Kalenderraster zu verkleinern.

#### Scenario: PDF enthält die maximale Legendenmenge

- **WHEN** acht Legendenzeilen dargestellt werden
- **THEN** überlappt keine Legendenzeile das Kalenderraster oder den Seitenrand
- **AND** der Kopfbereich zeigt weiterhin Titel, Abholort und Branding lesbar
- **AND** die redundante Fußzeile `Abfallkalender <Jahr> · <Abholort>` wird nicht dargestellt

#### Scenario: PDF enthält Ausweichtermine

- **WHEN** mindestens ein sichtbarer Termin als Ausweichtermin gekennzeichnet ist
- **THEN** belegt `* = Ausweichtermin` die erste Zeile innerhalb der höchstens acht Legendenzeilen
- **AND** der Asterisk wird rot und fett dargestellt

### Requirement: PDF kennzeichnet Ausweichtermine eindeutig

Das System SHALL jeden PDF-Abholungstermin, dessen wirksames Datum vom regulären Ursprungsdatum abweicht, sichtbar als Ausweichtermin kennzeichnen.

#### Scenario: Manuell verschobener Termin erhält einen Asterisk

- **WHEN** eine Tour- oder globale Datumsverschiebung einen regulären Abholungstermin auf ein anderes Datum verlegt
- **THEN** zeigt das PDF unmittelbar rechts neben der farbigen Fraktionsbox einen roten, fetten Asterisk
- **AND** der Asterisk liegt außerhalb der farbigen Box
- **AND** nachfolgende Fraktionsboxen überlappen den Asterisk nicht
- **AND** erklärt eine eigene Legendenzeile den Asterisk mit `* = Ausweichtermin`

#### Scenario: Feiertagsregel erzeugt einen Ausweichtermin

- **WHEN** eine Feiertagsregel das wirksame Datum eines regulären Abholungstermins verändert
- **THEN** kennzeichnet das PDF den betroffenen Abholungseintrag ebenfalls mit einem roten, fetten Asterisk

#### Scenario: Regulärer Termin bleibt unmarkiert

- **WHEN** das wirksame Datum eines Abholungstermins seinem regulären Ursprungsdatum entspricht
- **THEN** zeigt das PDF an diesem Abholungseintrag keinen Asterisk

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

### Requirement: Öffentliche Reminder-Actions prüfen Tokens vor jeder Mutation fail-closed

Das System SHALL konfigurierte Reminder-Statusseiten ohne Tokenverarbeitung ausliefern und DOI- sowie Abmeldeaktionen in getrennter, deterministischer Reihenfolge verarbeiten. Tokenformat, Kryptografie, Secretquelle und Repository-Verträge SHALL dabei unverändert bleiben.

#### Scenario: DOI-Aktion aktiviert nur nach vorhandenem Token

- **WHEN** ein Benutzer den DOI-Pfad ohne Token oder mit einem ungültigen beziehungsweise abgelaufenen Token aufruft
- **THEN** aktiviert das System kein Abo
- **AND** liefert es den konfigurierten Redirect oder die bestehende sichere Fallback-Seite

#### Scenario: Abmeldung mutiert erst nach vollständiger Signaturprüfung

- **WHEN** ein Abmeldetoken keine lesbare Subscription-ID besitzt, kein Abo gefunden wird oder die Signatur nicht zum gespeicherten Token-Hash passt
- **THEN** führt das System keine Abmeldemutation aus
- **AND** liefert es den konfigurierten Invalid-Token-Redirect oder die bestehende sichere Fallback-Seite

#### Scenario: Wiederholte Abmeldung bleibt idempotent

- **WHEN** ein gültiger Abmeldelink für ein bereits abgemeldetes Abo erneut aufgerufen wird
- **THEN** bleibt der Status `already_unsubscribed` erhalten
- **AND** Redirect, Statusseite und sichtbare Texte entsprechen weiterhin dem bestehenden Vertrag

#### Scenario: Konfigurierte Statusseite hat Vorrang vor Aktionsverarbeitung

- **WHEN** ein Request einen konfigurierten Aktivierungs-, Abmelde- oder Invalid-Token-Statuspfad adressiert
- **THEN** rendert das System die zugehörige Statusseite ohne Hash-, Lookup- oder Mutationsaufruf

### Requirement: Öffentliche App zeigt verfügbare Standortoptionen unmittelbar

Das System SHALL in jedem noch offenen Schritt der Standortauswahl alle verfügbaren Optionen bereits vor einer Texteingabe anzeigen und die sichtbare Liste bei einer Eingabe nach dem Suchtext filtern.

#### Scenario: Auswahloptionen sind ohne Suchtext vollständig sichtbar

- **WHEN** ein Standortauswahlschritt mehrere verfügbare Optionen enthält
- **THEN** zeigt die App alle Optionen unmittelbar in einer scrollbar begrenzten Liste
- **AND** verlangt sie keine vorherige Texteingabe
- **AND** kennzeichnet sie sichtbar, wenn unterhalb des aktuellen Ausschnitts weitere Optionen vorhanden sind
- **AND** filtert sie die Liste nach einer Eingabe auf passende Optionen

### Requirement: Öffentliche Waste-Terminprojektion verwendet dieselbe wirksame Tourverschiebung

Das System SHALL für öffentliche Kalender-, PDF- und iCal-Ausgaben dieselbe framework-agnostische Auswahlregel für tourbezogene Ausweichtermine verwenden wie Studio und Mainserver-Materialisierung.

#### Scenario: Jahresbezogene Ausnahme verdrängt die jährliche Grundregel

- **GIVEN** für eine Tour gilt eine jahresunabhängige Grundregel an einem Monat und Tag
- **WHEN** für ein konkretes Jahr zusätzlich eine jahresbezogene Ausnahme am selben Ursprung existiert
- **THEN** zeigt die öffentliche Terminprojektion in diesem Jahr ausschließlich das Ergebnis der jahresbezogenen Ausnahme
- **AND** wendet die jährliche Grundregel nicht zusätzlich an
- **AND** Kalenderansicht, PDF und iCal bleiben zueinander konsistent

#### Scenario: Öffentliche Projektion bleibt zeitzonenunabhängig

- **WHEN** öffentliche Kalenderdaten unter unterschiedlichen Prozesszeitzonen materialisiert werden
- **THEN** bleiben Original- und Zieldatum als ISO-Kalenderdaten identisch
- **AND** Sommer- oder Winterzeit verändert keinen Abholtag
