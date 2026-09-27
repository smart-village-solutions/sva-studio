## MODIFIED Requirements

### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailoberfläche entlang von Lebensphase und
Arbeitsmodus strukturieren. Die bestehende Detailroute SHALL einen kompakten
Kopf mit Instanzidentität, Lifecycle, davon getrenntem Betriebszustand und dem
festen Einstieg `Doctor öffnen` zeigen. Setup-Hinweise SHALL sich auf vorhandene
fachliche Evidenz beziehen. Die drei Modi `Betrieb`, `Doctor` und `Einstellungen`
SHALL ohne vorgeschaltete Sammel-Disclosure erreichbar sein. Wiederholte
Identitäts-, Lifecycle- und Gesamtstatuskarten SHALL entfallen.

#### Scenario: Bestandsinstanz oeffnet standardmaessig im Betrieb

- **WHEN** ein berechtigter Operator eine fertig eingerichtete Instanz öffnet
- **THEN** öffnet die Seite im Modus `Betrieb` mit Modulverwaltung als Hauptaufgabe
- **AND** konkurrieren Formular, Vollhistorie und abgeschlossener Setup-Fortschritt nicht im Erstblick

#### Scenario: Bestandsseite besitzt dauerhafte Modi statt gemischter Langseite

- **WHEN** ein Operator die Detailseite öffnet
- **THEN** zeigt der kompakte Kopf Identität, Lifecycle, Betriebszustand und den festen Doctor-Einstieg
- **AND** sind alle drei Modi unmittelbar und per Tastatur erreichbar
- **AND** bleibt die technische Historie innerhalb des Doctors

#### Scenario: Betrieb bleibt ruhig und fokussiert

- **WHEN** der Modus `Betrieb` sichtbar ist
- **THEN** priorisiert er Modulzuweisung, Modulentzug und laufende Verwaltungsaufgaben
- **AND** führt ein kurzer aktueller Befund zum gleichen dauerhaft erreichbaren Doctor
- **AND** wird der vollständige Audit nicht zusätzlich neben der Modulverwaltung gerendert

#### Scenario: Aktive Instanz mit Störung bleibt im Bestand

- **GIVEN** der Lifecycle lautet `active`
- **WHEN** Tenant-IAM oder ein erforderliches Plugin nicht bereit oder nicht verifiziert ist
- **THEN** bleiben Lifecycle und Betriebsbefund getrennt sichtbar
- **AND** bleibt `Betrieb` die Standardansicht, ohne automatischen Rücksprung zur Neuanlage
- **AND** wird aus `active` weder eine erfolgreiche aktuelle Prüfung noch eine neue Mutationsfreigabe abgeleitet

#### Scenario: Suspendierte oder archivierte Instanz startet keine Ersteinrichtung

- **WHEN** ein berechtigter Operator eine suspendierte oder archivierte Instanz öffnet
- **THEN** zeigt die Seite deren Lifecycle und vorhandene Diagnose im Bestandskontext
- **AND** bietet sie ausschließlich die vorhandenen zulässigen Verwaltungsaktionen an

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST einen dauerhaft sichtbaren Einstieg `Doctor öffnen` auf der
Bestandsseite bereitstellen. Diagnose- und Reparaturaktionen SHALL im Doctor
über dieselben vorhandenen Instanz-Handler und Guards wie im Einrichtungscockpit
ausgeführt werden. Der Doctor SHALL aktuelle Befunde, zulässige Maßnahme,
tatsächliches Ausführungsergebnis und Folgeprüfung zusammenhängend darstellen.
Die Aktivierung SHALL ausschließlich im vorhandenen geschützten Abschluss des
Einrichtungscockpits ausgeführt werden; der Doctor SHALL dorthin verweisen.

#### Scenario: Doctor-Einstieg ist immer sichtbar

- **WHEN** ein berechtigter Operator eine Bestandsinstanz öffnet
- **THEN** ist `Doctor öffnen` immer an derselben Stelle sichtbar
- **AND** bleibt der Einstieg auch ohne automatisch erkannten Befund nutzbar

#### Scenario: Erkanntes Problem verstaerkt denselben Doctor-Einstieg

- **WHEN** ein degradierter oder blockierter Befund vorliegt
- **THEN** verstärkt ein kurzer Hinweis denselben Doctor-Einstieg
- **AND** bleibt dessen Position unverändert
- **AND** zeigt der Hinweis den betroffenen Bereich statt einer zweiten Vollanalyse

#### Scenario: Doctor fuehrt durch Diagnose und Reparatur

- **WHEN** der Operator den Doctor öffnet
- **THEN** folgt die Oberfläche `Überblick`, `Empfohlene Maßnahme`, `Reparatur ausführen` und `Validieren`
- **AND** sind erfolgreiche Prüfungen im Überblick zusammengefasst sichtbar und im Detail aufklappbar
- **AND** folgen technische Historie und ausführlicher Audit auf die aktuellen Befunde

#### Scenario: Empfohlene Maßnahme ist vor Ort ausführbar

- **GIVEN** die vorhandenen Verträge erlauben eine konkrete Diagnose- oder Reparaturaktion für die Instanz
- **WHEN** diese als nächste Maßnahme im Doctor angezeigt wird
- **THEN** kann der Operator sie dort über denselben Handler auslösen
- **AND** gelten Instanz-/Run-Bezug, Planbindung, Reauth, Bestätigung und Retry-Bedingungen unverändert
- **AND** wird keine zweite hervorgehobene Cockpit-Aktion gleichzeitig angezeigt

#### Scenario: Doctor verweist zur Aktivierung in das Einrichtungscockpit

- **GIVEN** die serverseitige nächste Aktion lautet `instance.status.activate`
- **WHEN** der Operator die empfohlene Maßnahme im Doctor auswählt
- **THEN** öffnet die UI den bestehenden Aktivierungsabschnitt im Einrichtungscockpit und fokussiert dessen Überschrift
- **AND** löst diese Navigation keine Mutation aus
- **AND** bleiben aktuelle Betriebsnachweise, manuelle Hinweise, Fresh-Reauth und revisionsgebundene Bestätigung Voraussetzung der dortigen Aktivierung
- **AND** entsteht kein zweiter ausführbarer Aktivierungspfad im Doctor

#### Scenario: Fehlende oder veraltete Freigabe erlaubt keine Reparatur

- **WHEN** die nächste mutierende Aktion fehlt oder der erforderliche Plan nicht mehr aktuell ist
- **THEN** ist die Mutation nicht ausführbar
- **AND** führt die UI zur vorhandenen lesenden Prüfung oder Planaktualisierung
- **AND** ersetzt sie die Freigabe nicht durch einen lokalen Erfolgsbadge

#### Scenario: Maßnahmenerfolg ersetzt keine Folgeprüfung

- **WHEN** ein Auftrag angenommen oder eine Reparaturmutation erfolgreich beantwortet wird
- **THEN** zeigt der Doctor genau dieses Ergebnis und die verfügbare Folgeprüfung
- **AND** behauptet er vollständige Betriebsbereitschaft erst auf entsprechender aktueller Evidenz
- **AND** bleibt frühere fehlgeschlagene Evidenz als Historie erkennbar

### Requirement: Instanz-Cockpit zeigt Befund fuer IAM-Basis aktiver Module

Das System SHALL auf der Instanz-Detailseite einen expliziten Befund für die
IAM-Basis aktiver Module anzeigen und dem berechtigten Studio-Admin die
vorhandene direkte Reparaturaktion anbieten. Der Befund SHALL in die aktuelle
Aufgabe beziehungsweise den Modul-Workspace integriert werden und SHALL keine
zusätzliche dauerhaft gleichrangige Diagnosekarte erzeugen.

#### Scenario: Cockpit zeigt Reparaturpfad fuer IAM-Basis-Drift

- **GIVEN** aktive Module besitzen eine unvollständige IAM-Basis
- **WHEN** der Studio-Admin die Instanz-Detailseite öffnet
- **THEN** zeigt sie einen degradierten Befund mit verständlicher Klartextzeile und operativer Auswirkung
- **AND** bietet sie die bestehende direkte Aktion zum Neu-Seeden von Berechtigungen und Systemrollen an
- **AND** bleibt diese Aktion ausschließlich für berechtigte Studio-Admins verfügbar

#### Scenario: Cockpit zeigt Empty-State fuer Bestandsinstanz ohne zugewiesene Module

- **GIVEN** die Bestandsinstanz besitzt keine zugewiesenen Module
- **WHEN** der Studio-Admin die Detailseite öffnet
- **THEN** erklärt der Betriebsbereich diesen erwarteten Ausgangszustand und die Zuweisung im selben Workspace
- **AND** bleibt alternativ `/admin/modules` als Sammelarbeitsplatz erreichbar
- **AND** wird der leere Modulsatz nicht als Fehler oder neuer Setup-Pflichtschritt gewertet

### Requirement: Instanz-Detailseite zeigt Modultransparenz fuer alle global bekannten Module

Das System SHALL auf der Instanz-Detailseite alle global bekannten sowie noch
gespeicherten, aktuell nicht verfügbaren Module in einer gemeinsamen
Root-Admin-Modulansicht darstellen. Zuweisung, effektive Aktivierung und
technische Bereitschaft SHALL unterscheidbar bleiben und ausschließlich aus
ihren vorhandenen Verträgen stammen. Beschreibung und vorhandener Anzeigename
SHALL aus den Plugin-Metadaten stammen; technische IDs bleiben nachvollziehbar.

#### Scenario: Instanz zeigt aktive und deaktivierte Module in der Betriebsansicht

- **WHEN** der Studio-Admin `Betrieb` öffnet
- **THEN** zeigt die UI alle global bekannten Module in einer gemeinsamen Tabelle oder gleichwertigen Liste
- **AND** unterscheidet sie anhand des vorhandenen Root-Vertrags zugewiesene und nicht zugewiesene Module
- **AND** zeigt sie Beschreibung und vorhandene Aktivierungsrichtlinie, Herkunft und Overrides auf Anforderung
- **AND** erscheint technische Readiness getrennt von Zuweisung und effektiver Aktivierung

#### Scenario: Fehlende Modulbeschreibung nutzt Fallback ohne die Tabelle zu verbergen

- **GIVEN** ein Modul liefert keine auflösbare Beschreibung
- **WHEN** seine Zeile angezeigt wird
- **THEN** bleibt das Modul mit definiertem Fallbacktext sichtbar
- **AND** bleibt die Übersicht der übrigen Module unverändert bedienbar

#### Scenario: Zugewiesenes Modul wartet auf technische Bereitstellung

- **GIVEN** ein Modul ist zugewiesen, seine aktuelle technische Readiness aber noch nicht bereit
- **WHEN** der Betriebsbereich angezeigt wird
- **THEN** bleiben Zuweisung und ausstehende oder blockierte Bereitschaft gleichzeitig sichtbar
- **AND** führt die passende Aktion zum Befund oder vorhandenen aktiven Job
- **AND** wird das Modul nicht aufgrund seiner Zuweisung als technisch bereit bezeichnet

#### Scenario: Fehlende und nicht vorgesehene Readiness sind verschieden

- **WHEN** ein Modul keinen Lifecycle-Vertrag hat
- **THEN** zeigt die UI, dass keine technische Prüfung vorgesehen ist
- **AND** zeigt sie bei einem erwarteten, aber fehlenden oder fehlerhaft geladenen Readiness-Datensatz stattdessen `Nicht verifiziert`
- **AND** wird keiner dieser Zustände als erfolgreich geprüfte Bereitschaft behandelt

#### Scenario: Nicht mehr verfügbares Modul bleibt nachvollziehbar

- **GIVEN** eine gespeicherte Modulzuweisung oder Aktivierung hat aktuell keinen verfügbaren Plugin-Vertrag
- **WHEN** die Modulansicht aufgebaut wird
- **THEN** bleibt die technische ID mit dem Zustand `Nicht verfügbar` sichtbar
- **AND** wird weder eine neue Zuordnung noch eine Reparaturoperation aus ähnlichen Namen geraten

### Requirement: Instanz-Detailseite bietet einen Root-Admin-Modul-Workspace in der Betriebsansicht

Das System SHALL unter `/admin/instances/:instanceId` im Tab `Betrieb` die
gemeinsame Modulverwaltung für genau diese Instanz bereitstellen. Der bestehende
Workspace SHALL Zuweisung, Transparenz und verfügbare Readiness pro Modul
zusammenführen. `/admin/modules` SHALL als rootweiter Sammelarbeitsplatz dieselbe
fachliche Mutationslogik und unveränderte Zugriffskontrolle verwenden.

#### Scenario: Root-Admin verwaltet Module direkt im Instanz-Detail

- **WHEN** der Root-Admin den Tab `Betrieb` einer Instanz öffnet
- **THEN** sind zugewiesene und verfügbare Module innerhalb derselben Ansicht gruppiert oder gleichwertig filterbar
- **AND** stehen die bisherigen fachlichen Aktionen ohne erneute Instanzauswahl zur Verfügung
- **AND** ersetzen Zeilendetails die bisher getrennten Transparenz- und Readiness-Flächen

#### Scenario: Modulzuweisung und IAM-Baseline laufen ohne zusätzlichen Confirm-Schritt

- **WHEN** der Root-Admin ein Modul zuweist oder die IAM-Basis neu aufbaut
- **THEN** führt die UI die bestehende Root-only-Mutation direkt aus
- **AND** zeigt sie danach eine verständliche Ergebnisrückmeldung und die tatsächliche Bereitschaft
- **AND** wird aus dieser Rückmeldung keine neue Aktivierungsfreigabe abgeleitet

#### Scenario: Entzug und Admin-Struktur-Initialisierung verlangen eine explizite Bestätigung

- **WHEN** ein Root-Admin einen angebotenen Modulentzug oder die vorhandene Admin-Struktur-Initialisierung auslöst
- **THEN** verlangt die UI die bestehende explizite, instanzbezogene Bestätigung
- **AND** bleiben beim Entzug Systemrollen, Permissions-Anzahl und Folgen für Rollenbeziehungen/Nutzersitzungen in der Vorschau sichtbar
- **AND** wird ohne Bestätigung keine Mutation ausgeführt und durch das Redesign kein neuer Bootstrap-Pflichtschritt eingeführt

#### Scenario: Plugin-Reparatur respektiert laufenden Job und Policy

- **WHEN** die UI eine vorhandene Lifecycle-Reparatur anbietet
- **THEN** verwendet sie nur die im bestehenden Vertrag angebotene Operation für dieses Plugin und diese Instanz
- **AND** bleiben laufende Jobs, Policy-Vorgaben und Berechtigungen für die Bedienbarkeit maßgeblich
- **AND** bewirkt mehrfaches Betätigen während einer ausstehenden Aktion keine zusätzliche Mutation

## ADDED Requirements

### Requirement: Instanzliste priorisiert Orientierung und belegten Handlungsbedarf

Die Instanzliste SHALL Name, ID, Adresse, Lifecycle, Suche und Statusfilter
beibehalten, Parent-Domain als ergänzende Information zugänglich halten und
seltene Lifecycle-Aktionen unter `Weitere Aktionen` anbieten. Handlungsbedarf
SHALL nur aus tatsächlich verfügbaren Listendaten oder ausdrücklich gestarteten
Audit-Ergebnissen stammen. Zusätzliche Detailabfragen pro Zeile sind dafür
nicht zulässig.

#### Scenario: Liste öffnet die passende Instanz ohne technische Überlastung

- **WHEN** die Instanzliste geladen wird
- **THEN** öffnet der Instanzname die vorhandene Detailroute und bleibt die Adresse als externer Link erkennbar
- **AND** ist `Instanz anlegen` die hervorgehobene Seitenaktion
- **AND** bleiben Suspendieren und Archivieren im beschrifteten Zeilenmenü mit bestehenden Guards erreichbar
- **AND** wird keine direkte ungeprüfte Aktivierung ergänzt

#### Scenario: Unbekannter Betriebszustand wird nicht als gesund angezeigt

- **GIVEN** für einen Listeneintrag liegen keine hinreichenden aktuellen Betriebsprüfungen vor
- **WHEN** die Liste den Lifecycle darstellt
- **THEN** behauptet sie keinen erfolgreichen Tenant-IAM- oder Plugin-Check
- **AND** kann sie anhand vorhandener Evidenz zur Einrichtung oder Diagnose führen
- **AND** erzeugt das Rendering keine Detailabfrage für jede Tabellenzeile

#### Scenario: Gesamt-Audit bleibt auf Anforderung vollständig lesbar

- **WHEN** der Benutzer den bestehenden Gesamt-Audit startet
- **THEN** bleiben Laufstatus, Zeitpunkt, Zielinstanzen und sämtliche Prüfergebnisse an einer aufklappbaren Stelle zugänglich
- **AND** gibt es keine zweite Darstellung desselben vollständigen Berichts

### Requirement: Instanzanlage bündelt Entscheidungen und bietet vollständige Korrekturprüfung

Der vorhandene vierstufige Assistent SHALL die Realm-Modus-Entscheidung im Schritt
`Nutzer-Datenbank (Keycloak-Realm)` bündeln und eine vollständige fachliche Review
mit direkter Korrekturrückkehr anbieten. Pflichtfelder, Defaults, Ableitungen,
Secret-Vertrag, Realm-Katalog und serverseitige Create-Readiness SHALL erhalten
bleiben. Technische Standardwerte SHALL read-only auf Anforderung zugänglich sein.

#### Scenario: Neuer Realm ist ohne technische Details anlegbar

- **WHEN** der Benutzer Instanzdaten und alle vier Admin-Angaben gültig erfasst und `Neu einrichten` wählt
- **THEN** kann er den bestehenden Standardpfad ohne Öffnen technischer Details durchlaufen
- **AND** bleiben Instanz-ID, Anzeigename und Parent-Domain im ersten Schritt
- **AND** werden Standard-Clients und Realm-/Issuer-Ableitungen nicht zu zusätzlichen Pflichtfragen
- **AND** bleibt die technische Anlage von der nachfolgenden Einrichtung und manuellen Aktivierung getrennt

#### Scenario: Review zeigt alle fachlichen Eingaben mit gezielter Korrektur

- **WHEN** der Benutzer `Prüfen und anlegen` erreicht
- **THEN** zeigt die Seite Instanzdaten, Realm-Entscheidung und Benutzername, E-Mail, Vorname und Nachname des initialen Administrators
- **AND** öffnet `Ändern` den zugehörigen Schritt mit erhaltenen Werten
- **AND** führt `Weiter` nach gültiger Korrektur direkt zum Review zurück, soweit keine neue abhängige Eingabe erforderlich ist
- **AND** bleibt der gesamte Submit einschließlich übersprungener Schritte validiert

#### Scenario: Geänderter Entwurf benötigt passende Readiness

- **WHEN** der Benutzer nach einer erfolgreichen Prüfung relevante Eingaben verändert
- **THEN** gilt das vorherige Ergebnis nicht mehr als Freigabe für den neuen Entwurf
- **AND** kann eine verspätete Antwort auf den alten Entwurf die Anlage nicht freigeben
- **AND** bleibt `Instanz anlegen` bis zum passenden aktuellen Ergebnis ohne Anlageblocker gesperrt

#### Scenario: Blockergruppen bleiben trotz kompakter Darstellung unterscheidbar

- **WHEN** die Draft-Readiness Anlage-, Bereitstellungs- oder Aktivierungsbefunde liefert
- **THEN** bleiben alle Anlageblocker und notwendigen Nutzerhandlungen offen sichtbar
- **AND** können gewöhnliche automatisch auszuführende Arbeiten kompakt zusammengefasst werden
- **AND** sind wartende oder blockierte Fähigkeiten mit ihrer Auswirkung sichtbar
- **AND** wird ein ausschließlich nachgelagerter Blocker nicht zur zusätzlichen Create-Sperre

### Requirement: Einrichtung zeigt eine aktuelle Aufgabe mit bestehenden Freigaben

Das gemeinsame Einrichtungscockpit SHALL die fünf bestehenden Schritte kompakt
darstellen und nur die aktuelle Aufgabe ausführlich zeigen. Ergebnis, Auswirkung
und höchstens eine hervorgehobene nächste Aktion SHALL sichtbar sein. Die UI SHALL
die vorhandenen serverseitigen Aktions-, Plan-, Retry- und Aktivierungsverträge
verwenden und keine zusätzliche Browserabnahme oder lokale Freigabe einführen.

#### Scenario: Planfreigabe zeigt die wirklichen Änderungen

- **GIVEN** ein aktueller bestätigbarer Plan liegt vor
- **WHEN** die UI dessen Ausführung anbietet
- **THEN** zeigt sie die relevanten Create-/Update-Auswirkungen bereits vor der Bestätigung verständlich an
- **AND** sind vollständige Planschritte und Fingerprint aufklappbar
- **AND** wird genau dieser Stand mit dem vorhandenen Bestätigungs- und Ausführungspfad verbunden

#### Scenario: Gemischter Zustand erhält Teilerfolge und zeigt den Blocker

- **GIVEN** Keycloak-Schritte waren erfolgreich, der lokale IAM-/Administrator-Abgleich ist fehlgeschlagen
- **WHEN** das Cockpit die Instanz darstellt
- **THEN** sind die Keycloak-Teilerfolge, die fehlgeschlagene Phase und die blockierte Aktivierung gleichzeitig verständlich
- **AND** gibt es höchstens eine serverseitig zulässige nächste Hauptaktion
- **AND** führt diese weder einen erneuten Create noch eine unbegründete Wiederholung erfolgreicher Schritte aus

#### Scenario: Laufende Verarbeitung und Aktualisierungsfehler bleiben wahrheitsgemäß

- **WHEN** ein vorhandener Auftrag läuft oder auf Verarbeitung wartet
- **THEN** zeigt die UI den belegten Zustand, Schritt und verfügbaren Zeitstempel ohne erfundene Fortschrittsprozente
- **AND** verändern Refreshes nicht den aktuellen Fokus oder offene Formularentwürfe
- **AND** bleibt bei fehlgeschlagenem Refresh der letzte bekannte Zustand als solcher mit Aktualisierungshinweis sichtbar

#### Scenario: Manuelle Aktivierung bleibt eigener Abschluss

- **WHEN** die vorhandene Serverfreigabe die Aktivierung zulässt
- **THEN** bietet das Cockpit die ausdrücklich bestätigte Aktivierung mit den bestehenden Schutzbedingungen an
- **AND** behauptet die UI vor deren Erfolg keinen aktiven Lifecycle
- **AND** führt ihr Erfolg in den Betriebsbereich, ohne einen neuen Pflichtschritt zur Browserabnahme zu erzeugen

### Requirement: Instanzbefunde bleiben sichtbar und führen zur belegten Handlung

Die Instanzoberfläche SHALL aktuelle Fehler mit belegter Ursache oder ausdrücklich
unklarer Ursache, betroffener Funktion, Auswirkung und zulässiger Folgehandlung
darstellen. Blocker SHALL unabhängig vom Zustand technischer Disclosures sichtbar
bleiben. Freigegebene Diagnoseinformationen SHALL vollständig erreichbar sein;
Secrets, Tokens, Rohantworten und unzulässige personenbezogene Diagnosedaten
SHALL weder angezeigt noch in Diagnosetexte übernommen werden.
Vorhandene strukturierte Fehler SHALL über den bestehenden Hook-/API-Pfad bis
zur zuständigen Darstellung erhalten bleiben; unbekannte Codes SHALL einen
sicheren übersetzten Fallback ohne erfundene Ursache erhalten.

#### Scenario: Fehlerverweis öffnet den betroffenen Bereich

- **GIVEN** ein ungültiges Feld liegt in einem anderen Schritt, Tab oder eingeklappten Abschnitt
- **WHEN** der Benutzer nach einem Submit-Fehler den verlinkten Eintrag der fokussierten Fehlerübersicht auswählt
- **THEN** öffnet die UI den Zielbereich und fokussiert anschließend das Feld
- **AND** bleiben andere Eingaben, Dirty-State und weitere Fehler erhalten
- **AND** sind Inline-Fehler über `aria-invalid` und `aria-describedby` verbunden

#### Scenario: Unterschiedliche Ursachen erhalten passende Folgehandlungen

- **WHEN** ein Befund eine fehlende Berechtigung, einen Realm-Konflikt, eine nicht erreichbare Abhängigkeit oder einen unbekannten Fehler beschreibt
- **THEN** benennt die UI den belegten Fall und eine passende Korrektur, lesende Prüfung oder Diagnose
- **AND** wird eine mutierende Wiederholung ausschließlich bei bestehender sicherer Freigabe angeboten
- **AND** erfindet die UI keine konkrete Ursache, Serviceidentität oder Aktualität

#### Scenario: Workflowfehler behalten ihre belegte Klassifikation

- **GIVEN** Detail-Laden, Preflight oder Planung liefert einen strukturierten Fehler
- **WHEN** der vorhandene Hook diesen an die Oberfläche weitergibt
- **THEN** bleiben Status, Code, Request-ID, Klassifikation, Diagnosestatus, Handlungsempfehlung, sichere Details und Berechtigungsbefund soweit vorhanden erhalten
- **AND** wird etwa `database_unavailable` nicht zu `keycloak_unavailable` umgedeutet
- **AND** verwendet die Anzeige die bestehenden übersetzten Fehlermeldungen und freigegebenen Diagnosedetails

#### Scenario: Unbekannter Fehlercode behauptet keinen Dienstausfall

- **GIVEN** ein Workflow liefert einen bisher unbekannten Fehlercode ohne belegte Ursache
- **WHEN** die Oberfläche den Fehler darstellt
- **THEN** zeigt sie einen sicheren übersetzten Fallback mit vorhandener Korrelation und ausdrücklich unklarer Ursache
- **AND** behauptet sie keinen Keycloak-Ausfall und zeigt weder Rohantworten noch ungeprüfte Fehlermeldungstexte
- **AND** bietet sie keinen generischen mutierenden Retry an

#### Scenario: Zusammengefasste Befunde verlieren keine fachliche Achse

- **WHEN** mehrere Meldungen zusammengefasst werden
- **THEN** beziehen sie sich auf dieselbe Instanz, Achse beziehungsweise dasselbe Artefakt, dieselbe Ursache, Aktualität und Folgehandlung
- **AND** bleiben Konfiguration, Rechteprobe und Reconcile sowie deren Serviceidentitäten unterscheidbar
- **AND** führt der knappe Kopfhinweis zum vollständigen Befund statt denselben Volltext mehrfach zu rendern

#### Scenario: Blocker bleibt bis zur belegten Behebung sichtbar

- **WHEN** eine Aktion fehlschlägt oder aktuelle Evidenz weiter einen Blocker meldet
- **THEN** wird der Befund nicht zeitgesteuert ausgeblendet
- **AND** beseitigt eine reine Queue-Annahme oder vorübergehende Erfolgsmeldung ihn nicht
- **AND** erzeugt eine nicht blockierende Warnung keine zusätzliche fachliche Sperre

### Requirement: Instanzeinstellungen trennen fachliche Gruppen und lokale Speicherbereiche

Die Einstellungen SHALL die Gruppen `Allgemein`, `Erster Administrator`,
`Account-Einladung`, `Nutzer-Datenbank und Clients` und `Zugangsdaten` anbieten.
Technische Gruppen SHALL mit verständlicher Zusammenfassung aufklappbar sein;
notwendiger Handlungsbedarf bleibt außen sichtbar. Instanzeinstellungen und
Einladungsvorlage SHALL getrennte lokale Entwürfe und Speicherzustände besitzen
und ausschließlich über die vorhandenen Mutationsverträge gespeichert werden.

#### Scenario: Technische Felder bleiben auffindbar und werden nicht automatisch gespeichert

- **WHEN** ein Benutzer einen technischen Einstellungsbereich öffnet, bearbeitet oder schließt
- **THEN** bleiben alle bisherigen zulässigen Felder erreichbar und lokale Änderungen erhalten
- **AND** löst der Bereichswechsel keine Mutation aus
- **AND** persistiert erst die ausdrücklich benannte Aktion die Instanzeinstellungen

#### Scenario: Secret-Zustand und Secret-Wert bleiben getrennt

- **WHEN** die Einstellungen Zugangsdaten darstellen
- **THEN** zeigt die UI konfiguriert/fehlend/automatisch erzeugt ohne bestehende Secret-Werte auszugeben
- **AND** bleiben die bisherigen Bedingungen für manuelle Eingabe erhalten
- **AND** bedeutet leer lassen weiterhin unverändert und werden neue Secret-Eingaben erst nach erfolgreichem Save geleert

#### Scenario: Vorlage übernimmt keinen ungespeicherten Einstellungsentwurf

- **GIVEN** Name, Realm oder Secret wurden lokal geändert, aber nicht gespeichert
- **WHEN** der Benutzer die Einladungsvorlage speichert oder zurücksetzt
- **THEN** enthält der Vorlagen-Update-Payload keine dieser lokalen Änderungen
- **AND** stammen vom bestehenden Vollupdate benötigte übrige Werte aus dem gespeicherten Instanzsnapshot
- **AND** bleiben Einstellungsentwurf und Dirty-State nach erfolgreichem Vorlagen-Save erhalten
- **AND** laufen Instanz-Save und Vorlagen-Save nicht gleichzeitig

#### Scenario: Vorlagenkonflikt bleibt konkret korrigierbar

- **WHEN** die bestehende Vorlagenrevision beim Speichern nicht mehr aktuell ist
- **THEN** zeigt der Editor einen wahrnehmbaren Revisionskonflikt mit Möglichkeit zum erneuten Laden
- **AND** wird der Konflikt nicht als generischer Speicherfehler oder Erfolg dargestellt
- **AND** bleiben Vorlagenentwurf und fremde lokale Einstellungen bis zur bewussten Korrektur erhalten

### Requirement: Instanzarbeitsbereiche bewahren zugängliche Form- und Navigationszustände

Die neu geordneten Instanzformulare SHALL die vorhandenen Studio-Form-Primitiven
mit dem RHF-/Zod-Standard verwenden und deutsche/englische Texte über das
Translationssystem beziehen. Tastaturbedienung, Fokus, Entwürfe und Fehler SHALL
über Schritte, Tabs, Dialoge und Hintergrundaktualisierungen hinweg konsistent
bleiben. Status SHALL zusätzlich zur Farbe textlich erkennbar sein.
Der Entwurferhalt SHALL für die geöffnete Oberfläche gelten; für vollständige
Seitenwechsel zur Anmeldung wird keine Wiederherstellung zugesagt. Der Change
SHALL keine zusätzliche Entwurfspersistenz einführen.

#### Scenario: Bereichswechsel und Refresh erhalten den Entwurf

- **WHEN** ein Benutzer zwischen Bereichen wechselt oder Statusdaten im Hintergrund aktualisiert werden
- **THEN** bleiben seine Werte, Fehler und Dirty-State erhalten
- **AND** stiehlt das Refresh keinen Fokus
- **AND** werden verspätete Antworten für eine vorherige Instanz nicht in die aktuell geöffnete Instanz übernommen

#### Scenario: Lokaler Fehler erhält den Entwurf innerhalb der geöffneten Oberfläche

- **WHEN** ein Fehler oder eine bestehende Reauth-Interaktion ohne vollständigen Seitenwechsel auftritt
- **THEN** bleiben lokale Eingaben, Fehler und Dirty-State erhalten
- **AND** gilt dies auch für noch nicht gespeicherte Secret-Eingaben im lokalen Formularzustand

#### Scenario: Vollständige Neuanmeldung folgt dem bestehenden Session-Vertrag

- **WHEN** der bestehende AuthProvider wegen abgelaufener Session vollständig zur Anmeldung navigiert
- **THEN** bleibt dieser Anmelde- und Session-Recovery-Pfad unverändert
- **AND** wird keine Wiederherstellung des lokalen Entwurfs nach dem Seitenwechsel vorausgesetzt
- **AND** werden Entwürfe dafür nicht zusätzlich persistiert und Secret-Eingaben weder in Browser-Storage noch URLs oder Logs übernommen

#### Scenario: Tastatur und schmaler Viewport behalten alle Aufgaben bei

- **WHEN** der Benutzer die Oberfläche per Tastatur, bei 320 CSS-Pixeln Breite oder mit 200 Prozent Zoom bedient
- **THEN** bleiben Hauptaktion, Fehler, Fachbereiche und Experten-Details ohne horizontales Seiten-Scrolling erreichbar
- **AND** besitzen Menüs und Disclosures verständliche Namen und Zustände
- **AND** gibt ein geschlossener Dialog den Fokus an seinen Auslöser zurück
- **AND** werden wesentliche Statusänderungen zugänglich angekündigt

#### Scenario: Neue Anordnung erhält Sprache und Komponentenstandard

- **WHEN** neue Labels, Hilfen, Fehler oder Bedienelemente im Instanzbereich entstehen
- **THEN** verwenden sie vorhandene native, shadcn- oder Studio-Primitiven und vollständige de/en-Ressourcen
- **AND** bleibt die Bezeichnung `Nutzer-Datenbank (Keycloak-Realm)` im Standardablauf erhalten
- **AND** ist der read-only Studio-Kontext weiterhin `Smart Village App` oder `KasselDIALOG`
- **AND** entsteht keine parallele allgemeine Formular- oder Diagnoseplattform
