## ADDED Requirements
### Requirement: Studio ordnet den E-Mail-Erinnerungsdienst ausschließlich dem Waste-Management-Modul zu
Das System SHALL alle Studio-seitigen Konfigurations- und Pflegeoberflächen des öffentlichen E-Mail-Erinnerungsdienstes ausschließlich im Modul `waste-management` verankern.

#### Scenario: Keine modulübergreifende Verlagerung in generische Studio-Settings
- **WHEN** ein berechtigter Benutzer Konfigurationen des öffentlichen E-Mail-Erinnerungsdienstes im Studio pflegt
- **THEN** erfolgen diese Pflegevorgänge ausschließlich innerhalb des Waste-Management-Moduls
- **AND** das Studio modelliert dafür keine konkurrierende globale E-Mail-Settings-Oberfläche außerhalb von `waste-management`
- **AND** die fachliche Verantwortung des Dienstes bleibt dem Waste-Kontext eindeutig zugeordnet

### Requirement: Waste-Management pflegt keine technischen SMTP-Credentials des E-Mail-Erinnerungsdienstes
Das System SHALL die technischen Transport-Credentials des E-Mail-Erinnerungsdienstes nicht im Waste-Management-Modul pflegen.

#### Scenario: Waste-Management beschränkt sich auf fachliche Kommunikationskonfiguration
- **WHEN** ein berechtigter Benutzer die Card des E-Mail-Erinnerungsdienstes im Tab `output` des Waste-Managements bearbeitet
- **THEN** pflegt er dort keine SMTP-Hosts, Ports, Benutzernamen oder Secrets
- **AND** diese technischen Versandparameter liegen ausschließlich in einer zentralen Mail-Transport-Konfiguration unter `interfaces`
- **AND** Waste-Management pflegt nur fachlich sichtbare Kommunikationsparameter wie Absenderanzeige, Reply-To, URLs, Texte und Leitplanken

### Requirement: Waste-Management bietet im Tab `output` eine globale Card für den E-Mail-Erinnerungsdienst
Das System SHALL im Waste-Management im bestehenden Tab `output` eine eigene Card für den öffentlichen E-Mail-Erinnerungsdienst bereitstellen.

#### Scenario: Output-Card bündelt die globale Dienstkonfiguration
- **WHEN** ein berechtigter Benutzer den Tab `output` des Waste-Managements der aktiven Instanz öffnet
- **THEN** sieht er eine eigene Card `E-Mail-Erinnerungsdienst`
- **AND** die Card ist von den fraktionsspezifischen Reminder-Einstellungen getrennt
- **AND** die Card bündelt nur globale Einstellungen des öffentlichen E-Mail-Kanals

### Requirement: Die Output-Card steuert Aktivierung, Rücksprung-URLs und Absenderdaten des Dienstes
Das System SHALL zentrale Betriebsparameter des E-Mail-Erinnerungsdienstes instanzbezogen pflegbar machen.

#### Scenario: Instanz pflegt öffentliche Basis-URL und Rücksprungziele
- **WHEN** ein berechtigter Benutzer die globale Dienstkonfiguration bearbeitet
- **THEN** kann er mindestens die Public-Base-URL sowie Pfade oder Ziel-URLs für DOI-Bestätigung und Abmeldung pflegen
- **AND** die öffentliche App und die versendeten E-Mails verwenden diese Konfiguration als führenden Vertrag

#### Scenario: Instanz pflegt Absender- und Antwortdaten
- **WHEN** ein berechtigter Benutzer die Card speichert
- **THEN** kann die Konfiguration mindestens Absendername, Absender-E-Mail und optional Reply-To enthalten
- **AND** unvollständige oder fachlich ungültige Versandkonfigurationen werden serverseitig abgewiesen

### Requirement: Waste-Management übergibt Versandaufträge an eine zentrale Mail-Transport-Schnittstelle
Das System SHALL die technische E-Mail-Zustellung nicht im Waste-Modul selbst ausführen, sondern an eine zentrale Mail-Transport-Schnittstelle delegieren.

#### Scenario: Waste materialisiert Versandaufträge statt selbst zuzustellen
- **WHEN** DOI-Mails, Aktivierungsbestätigungen oder Reminder-Mails fällig werden
- **THEN** erzeugt Waste einen normalisierten Versandauftrag mit allen fachlich nötigen Daten
- **AND** die zentrale Mail-Transport-Schnittstelle übernimmt daraus Transport, Retry und Provider-Anbindung
- **AND** Waste bleibt Eigentümer der fachlichen Auslöselogik und der zugehörigen Abo-Persistenz

### Requirement: Waste-Management spezifiziert den Reminder-Versand als ressourcenschonende Outbox-Architektur
Das System SHALL den fachlichen Reminder-Versand des Waste-Moduls über inkrementelle Materialisierung und eine Outbox-Architektur definieren.

#### Scenario: Waste führt keine zyklischen Vollscans aller Reminder-Abos aus
- **WHEN** das Waste-Modul fällige Reminder-Sendungen vorbereitet
- **THEN** materialisiert es gezielt Versandaufträge aus relevanten Fachänderungen oder kleinen Vorlauf-Fenstern
- **AND** es vermeidet periodische Vollscans über alle aktiven Abo-, Fraktions- und Terminbeziehungen

#### Scenario: Outbox bleibt auf den Hot Path optimiert
- **WHEN** Waste Versandaufträge persistiert
- **THEN** enthalten diese nur die für Zustellung und Template-Auflösung nötigen fachlichen Daten
- **AND** die Persistenz verwendet Dedupe-Keys und geeignete Hot-Path-Indizes für Status und Versandzeitpunkt
- **AND** vollständige Mail-Inhalte werden nicht als primäre Scheduling-Persistenz vorab erzeugt

### Requirement: Die Output-Card pflegt Rechtslinks und Einwilligungstexte für das öffentliche Formular
Das System SHALL die datenschutz- und rechtsrelevanten Texte des öffentlichen Formulars instanzbezogen pflegbar machen.

#### Scenario: Datenschutz-Checkbox wird aus der Output-Card gespeist
- **WHEN** das öffentliche Formular für die E-Mail-Erinnerung gerendert wird
- **THEN** verwendet es den in der Output-Card gepflegten Text der Zustimmungscheckbox
- **AND** verlinkt mindestens die konfigurierte Datenschutzerklärung
- **AND** die gespeicherte Zustimmung bleibt auf eine konfigurierte Textversion referenzierbar

#### Scenario: Impressum und Datenschutz bleiben als Links statt Langtext modelliert
- **WHEN** ein Benutzer Reminder- oder DOI-Mails erhält
- **THEN** stammen die Links auf Impressum und Datenschutzerklärung aus der globalen Card
- **AND** das System erzwingt nicht, vollständige Rechtstexte in jede Mail einzubetten

### Requirement: Die Output-Card verwaltet Textbausteine für DOI-, Reminder- und Abmeldekommunikation
Das System SHALL die öffentlichen und versandbezogenen Textbausteine des E-Mail-Erinnerungsdienstes zentral pflegbar machen.

#### Scenario: Dienst pflegt eigenständige DOI- und Reminder-Texte
- **WHEN** ein berechtigter Benutzer die Kommunikationsbausteine bearbeitet
- **THEN** kann er mindestens Betreff und Einleitung für DOI-Mails, Reminder-Mails und die Erfolgsseiten für Aktivierung und Abmeldung pflegen
- **AND** die öffentliche App sowie die Mails verwenden diese Textbausteine konsistent

#### Scenario: Reminder-Texte bleiben fachlich templatisiert
- **WHEN** eine Reminder-Mail für eine konkrete Fraktion und einen konkreten Termin erzeugt wird
- **THEN** ergänzt das System die gepflegten Textbausteine um den Standort-, Fraktions- und Terminbezug
- **AND** die Instanz pflegt keine vollständig statischen Komplettmails pro Einzelfall

### Requirement: Die Output-Card definiert technische Leitplanken des öffentlichen E-Mail-Dienstes
Das System SHALL technische Sicherheits- und Betriebsleitplanken des E-Mail-Erinnerungsdienstes instanzbezogen konfigurierbar machen.

#### Scenario: Instanz pflegt Token- und Pending-Lebensdauer
- **WHEN** ein berechtigter Benutzer die technischen Leitplanken bearbeitet
- **THEN** kann er mindestens die Gültigkeitsdauer von DOI-Tokens und die maximale Lebensdauer von Pending-Abos konfigurieren
- **AND** die Serverlogik erzwingt diese Grenzen bei Bestätigung und Bereinigung

#### Scenario: Instanz pflegt Anti-Abuse-Leitplanken
- **WHEN** die Card technische Betriebsparameter speichert
- **THEN** kann sie mindestens Rate-Limits oder äquivalente Anti-Abuse-Grenzen für Formular und DOI-Verkehr definieren
- **AND** die öffentliche Host-Fassade wendet diese Grenzen serverseitig an
