## ADDED Requirements
### Requirement: Öffentliche App bietet einen E-Mail-Erinnerungseinstieg im finalen Standortkontext
Das System SHALL in der öffentlichen Abfallkalender-App einen Einstieg zur Einrichtung von E-Mail-Erinnerungen bereitstellen, sobald der Standort vollständig aufgelöst wurde.

#### Scenario: CTA erscheint erst nach vollständiger Standortauflösung
- **WHEN** ein Benutzer den öffentlichen Kalender aufruft und Region, Ort, Straße sowie Hausnummerkontext vollständig bestimmt sind
- **THEN** zeigt die App eine Aktion `E-Mail-Erinnerung einrichten`
- **AND** die Aktion ist an genau den aktuell geladenen Standortkontext gebunden
- **AND** der Benutzer muss den Standort für die Erinnerung nicht erneut eingeben

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
