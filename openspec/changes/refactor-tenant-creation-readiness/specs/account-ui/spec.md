## MODIFIED Requirements

### Requirement: Instanz-Anlage-Flow fuehrt einen gefuehrten Admin-Bootstrap-Abschnitt

Das System SHALL nach erfolgreicher Instanz-Anlage den geführten
Admin-Bootstrap im gemeinsamen Einrichtungscockpit fortsetzen. Es SHALL keinen
separaten einmaligen Flow `Setup abschliessen` als zweiten Folgepfad anbieten.
Die spätere Stammdatenverwaltung SHALL der Einrichtung nachgeordnet bleiben.

#### Scenario: Erfolgreiche Anlage führt in das Einrichtungscockpit

- **WHEN** eine Instanz erfolgreich angelegt wurde
- **THEN** öffnet die UI das gemeinsame Einrichtungscockpit
- **AND** führt es durch die noch offenen Bootstrap- und Bereitstellungsschritte
- **AND** verwendet es dieselben serverseitigen Gates wie HTTP und MCP

#### Scenario: Stammdaten bleiben im Bestand nachgeordnet

- **WHEN** ein Operator nach abgeschlossener Einrichtung Vertrags- oder
  Stammdaten ändern möchte
- **THEN** findet er diese Änderungen im Modus `Einstellungen`
- **AND** nicht als konkurrierenden Setup-Flow in der Hauptarbeitsfläche

## ADDED Requirements

### Requirement: Instanz-Anlage zeigt Realm-Auswahl und Create-Readiness vor dem Speichern

Das System SHALL im Instanz-Anlage-Flow vor der verbindlichen Bestätigung die
serverseitige Create-Readiness anzeigen. Die UI SHALL Anlage-,
Bereitstellungs- und Aktivierungsblocker getrennt darstellen und SHALL für
`realmMode = existing` eine durchsuchbare Live-Auswahl statt des regulären
Freitextpfads verwenden.

#### Scenario: Bestands-Realm wird über eine zugängliche Suche gewählt

- **WHEN** ein Root-Administrator `Existing realm` auswählt
- **THEN** zeigt die UI eine durchsuchbare Combobox mit den aktuell
  serverseitig gelieferten Realms
- **AND** bleiben `master` und bereits zugeordnete Realms mit verständlicher
  Begründung sichtbar, aber nicht auswählbar
- **AND** ist der Auswahl- und Deaktivierungszustand per Tastatur und
  Screenreader verständlich

#### Scenario: Realm-Eignung wird vor Create dargestellt

- **WHEN** ein auswählbarer Bestands-Realm gewählt wurde
- **THEN** zeigt die UI genau eine Eignungsklasse `Bereit`,
  `Automatisch ergänzbar` oder `Manuelle Klärung erforderlich`
- **AND** zeigt sie bei automatisch ergänzbaren Befunden den konkreten noch
  nicht ausgeführten Änderungsplan
- **AND** nennt sie bei manuellen Konflikten betroffene Artefakte, Auswirkung,
  Behebung und erneute Prüfung

#### Scenario: Keycloak ist vor Create nicht verfügbar

- **WHEN** die aktuelle serverseitige Readiness Keycloak nicht erreichen oder
  nicht ausreichend autorisieren kann
- **THEN** zeigt die UI einen Anlageblocker
- **AND** deaktiviert sie die verbindliche Tenant-Anlage
- **AND** erklärt sie, welche betriebliche Voraussetzung hergestellt und wie
  die Prüfung anschließend wiederholt wird

#### Scenario: Background-Fähigkeit fehlt vor Create

- **WHEN** ein Worker, Callback, Provisioner oder nachgelagertes Zielsystem
  außerhalb Keycloaks nicht bereit ist
- **THEN** zeigt die UI den Befund als Bereitstellungsblocker mit seiner
  Auswirkung
- **AND** lässt sie die Tenant-Anlage zu, sofern keine Anlageblocker bestehen
- **AND** behauptet sie nicht, dass der technische Auftrag bereits
  angenommen oder abgeschlossen sei

#### Scenario: Submit prüft alle Wizard-Schritte erneut

- **WHEN** ein Benutzer Schritte direkt anspringt oder den Tenant verbindlich
  anlegt
- **THEN** validiert die UI alle vorausgehenden Pflichtfelder und
  Auswahlentscheidungen erneut
- **AND** kann kein übersprungener Schritt einen leeren Bestands-Realm oder
  unvollständige Tenant-Admin-Daten in den Create-Aufruf überführen

#### Scenario: Tenant-Admin-Profil ist vollständig

- **WHEN** ein Benutzer den Tenant-Admin-Schritt abschließen oder den Tenant
  anlegen will
- **THEN** verlangt die UI Benutzername, gültige E-Mail, Vorname und Nachname
- **AND** ordnet sie fehlende oder ungültige Werte den konkreten Feldern zu
- **AND** verwendet sie dieselben Regeln wie der serverseitige
  Create-Vertrag

#### Scenario: Bestands-Secret darf für späteren Abgleich leer bleiben

- **WHEN** ein Benutzer einen geeigneten Bestands-Realm gewählt hat
- **AND** das Tenant-Client-Secret noch nicht sicher vorliegt
- **THEN** darf das Secret-Feld für die Tenant-Anlage leer bleiben
- **AND** zeigt die UI den offenen Secret-Abgleich als Bereitstellungs- und
  Aktivierungsvoraussetzung
- **AND** behauptet sie keine erfolgte Rotation oder Übereinstimmung

### Requirement: Instanz-Anlage führt Einsteiger und Experten durch denselben Ablauf

Das System SHALL einen gemeinsamen vierstufigen Instanz-Anlage-Flow mit
progressiver Offenlegung verwenden. Der Standardpfad SHALL nur fachliche
Entscheidungen und notwendige Benutzereingaben zeigen. Technische Werte und
Diagnosen SHALL im selben Flow auf Anforderung zugänglich bleiben und dürfen
keinen parallelen Experten-Workflow bilden.

#### Scenario: Geführter Pfad verwendet verständliche Schritte

- **WHEN** ein Benutzer die Instanz-Anlage öffnet
- **THEN** zeigt die UI die Schritte `Instanz`,
  `Nutzer-Datenbank (Keycloak-Realm)`, `Erster Administrator` und
  `Prüfen und anlegen`
- **AND** dürfen zukünftige Schritte nicht ohne Validierung vorausgehender
  Pflichtangaben übersprungen werden
- **AND** bleiben bereits bearbeitete Schritte zur Korrektur erreichbar

#### Scenario: Technische Werte werden abgeleitet

- **WHEN** Studio Auth-Client-ID, Issuer-URL, Tenant-Admin-Client-ID,
  Hostname oder einen New-Realm-Namen eindeutig ableiten kann
- **THEN** erscheinen diese Werte nicht als freie Eingaben im Standardpfad
- **AND** zeigt die UI sie bei Bedarf read-only unter `Technische Details`
- **AND** bleiben ausschließlich fachlich notwendige und nicht ableitbare
  Werte editierbar

#### Scenario: UI bezeichnet die Nutzer-Datenbank eindeutig

- **WHEN** die UI Realm-Modus, Realm-Auswahl oder Realm-Eignung darstellt
- **THEN** verwendet sie im geführten Pfad die Bezeichnung
  `Nutzer-Datenbank (Keycloak-Realm)`
- **AND** verwendet sie `Realm` allein nur in technischen Details, Codes oder
  Diagnoseinformationen

#### Scenario: Studio-Instanz wird eindeutig bezeichnet

- **WHEN** die UI den aktuellen Umgebungskontext anzeigt
- **THEN** lautet der Anzeigename abhängig von der Umgebung exakt
  `Smart Village App` oder `KasselDIALOG`
- **AND** ist die Studio-Instanz read-only und keine Benutzerauswahl
- **AND** verändert der Anzeigename weder den fachlichen Flow noch dessen
  Gates

#### Scenario: Review trennt Auswirkungen

- **WHEN** die serverseitige Draft-Readiness für die abschließende Prüfung
  vorliegt
- **THEN** gruppiert die UI die Befunde als `Vor der Anlage zu beheben`,
  `Wird von Studio eingerichtet` und
  `Vor der Aktivierung noch erforderlich`
- **AND** nennt jeder Blocker Auswirkung, Behebung und Folgeprüfung
- **AND** bezeichnet die UI jede nicht bereite Hintergrundfähigkeit mit ihrem
  konkreten Fähigkeitsnamen und ihrer zugehörigen Handlungsempfehlung statt
  mehrere unterschiedliche Befunde generisch als technische Bereitschaft
- **AND** lautet die verbindliche Hauptaktion `Instanz anlegen`

#### Scenario: Erfolgreiche Anlage öffnet das gemeinsame Einrichtungscockpit

- **WHEN** die Registry-Persistenz erfolgreich war
- **THEN** führt die UI direkt zum Einrichtungscockpit der Instanz
- **AND** verwendet sie keine separate Setup-Strecke als zweiten fachlichen
  Folgepfad
- **AND** zeigt das Cockpit Anlage, Vorbereitung, Bestätigung,
  Bereitstellung, Betriebsprüfung und manuelle Aktivierung als gemeinsame
  Fortschrittsfolge

#### Scenario: Cockpit zeigt genau eine nächste Hauptaktion

- **WHEN** der Server eine zulässige nächste Aktion meldet
- **THEN** hebt die UI höchstens diese eine Aktion hervor
- **AND** fasst sie read-only Wiederholungsprüfungen unter `Erneut prüfen`
  zusammen
- **AND** verschiebt sie Diagnose- und Wartungsaktionen ohne unmittelbare
  Nutzerrelevanz in `Technische Details`

### Requirement: Instanz-Formularfehler sind feldbezogen und behebbar

Das System SHALL Validierungs- und Bereitschaftsfehler dem betroffenen
Eingabefeld oder Prozessschritt zugänglich zuordnen. Eine Fehlermeldung SHALL
mindestens Ursache, Auswirkung, erforderliche Änderung und Folgeprüfung
enthalten oder sicher auf eine betriebliche Diagnose mit Vorgangskennung
verweisen.

#### Scenario: Ungültiges Feld erhält unmittelbare Rückmeldung

- **WHEN** ein Benutzer eine ungültige Instanz-ID, Domain, E-Mail, Realm- oder
  Client-Konfiguration eingibt
- **THEN** markiert die UI das konkrete Feld mit `aria-invalid`
- **AND** verknüpft sie die verständliche Meldung über `aria-describedby`
- **AND** nennt sie das erwartete Format und soweit eindeutig einen gültigen
  Vorschlag

#### Scenario: Mehrere Fehler bleiben navigierbar

- **WHEN** mehrere Felder oder Schritte gleichzeitig ungültig sind
- **THEN** zeigt die UI eine verlinkte Fehlerzusammenfassung
- **AND** setzt sie den Fokus auf den ersten relevanten Fehler
- **AND** bleibt jeder Fehler zusätzlich am zugehörigen Feld oder Schritt
  sichtbar

#### Scenario: Unbekannter Fehler bietet keinen unsicheren Retry

- **WHEN** ein Fehler keine bestätigte sichere Wiederholbarkeit besitzt
- **THEN** zeigt die UI keine generische Retry-Aktion
- **AND** fordert sie dazu auf, keine Daten auf Verdacht zu ändern
- **AND** zeigt sie die vorhandene Vorgangskennung und den sicheren
  Diagnoseweg

### Requirement: Provisioning- und Aktivierungsaktionen folgen der serverseitigen nächsten Aktion

Das System SHALL mutierende Instanzaktionen nur anbieten, wenn der aktuelle
serverseitige Zustand genau diese Folgeaktion zulässt. Die UI SHALL keine
eigene parallele Freigabelogik aus lokalen Statusheuristiken ableiten.

#### Scenario: Provisioning benötigt aktuellen Plan

- **WHEN** kein aktueller bestätigbarer Plan vorliegt oder der Preflight
  blockiert ist
- **THEN** bietet die UI keine ausführbare Provisioning-Mutation an
- **AND** führt sie zur erneuten read-only Prüfung beziehungsweise
  Planerstellung

#### Scenario: Sicherer Retry ist schrittbezogen

- **WHEN** ein fehlgeschlagener Schritt als sicher retrybar klassifiziert ist
- **THEN** zeigt die UI die konkrete Retry-Aktion und ihre Auswirkung
- **AND** startet sie keinen pauschalen Create- oder Gesamtprozess-Retry

#### Scenario: Aktivierung wird nur im Einrichtungscockpit angeboten

- **WHEN** eine Instanz technisch bereit ist und die serverseitige nächste
  Aktion `instance.status.activate` lautet
- **THEN** bietet die UI die durch Fresh-Reauth und revisionsgebundene Bestätigung geschützte Aktivierung im geführten
  Einrichtungscockpit an
- **AND** zeigt sie vorher die aktuellen Betriebsnachweise und verbleibenden
  manuellen Hinweise

#### Scenario: Übersicht umgeht die Aktivierungsprüfung nicht

- **WHEN** eine Instanz in der allgemeinen Instanzübersicht angezeigt wird
- **THEN** bietet die Zeile keine ungesteuerte direkte Aktivierung an
- **AND** führt eine gegebenenfalls sichtbare Freigabeaktion in den
  technisch geprüften Aktivierungspfad

### Requirement: Bereitstellungszustand bleibt nach der Tenant-Anlage verständlich

Das System SHALL nach erfolgreicher Registry-Persistenz unterscheiden, ob die
technische Bereitstellung läuft, wartet, blockiert ist oder auf manuelle
Aktivierung wartet. Diese Projektion SHALL den bestehenden
Instanz-Lebenszyklus ergänzen und keine zweite Freigabequelle bilden.

#### Scenario: Tenant wartet auf Worker

- **WHEN** der Tenant gespeichert ist, aber kein Worker den dauerhaften
  Auftrag aktuell bearbeiten kann
- **THEN** zeigt die Übersicht beziehungsweise Detailseite
  `Bereitstellung wartet`
- **AND** nennt sie fehlende Fähigkeit, Auswirkung, Zuständigkeit und erneute
  Prüfung

#### Scenario: Tenant ist technisch blockiert

- **WHEN** ein technischer Schritt einen behebbaren Blocker besitzt
- **THEN** zeigt die Detailseite `Bereitstellung blockiert` mit dem konkreten
  Schritt
- **AND** bleiben bereits erfolgreiche Schritte und der gespeicherte Tenant
  sichtbar

#### Scenario: Tenant wartet auf manuelle Aktivierung

- **WHEN** alle technischen Blocker behoben und die erforderlichen
  Postflights erfolgreich sind
- **THEN** zeigt die Detailseite `Aktivierung ausstehend`
- **AND** bezeichnet sie diesen Zustand nicht als `Active` oder vollständig
  betriebsbereit

#### Scenario: Aktivierung schließt die Einrichtung ab

- **WHEN** die technischen Bereitschaftsprüfungen erfolgreich sind und die
  ausdrücklich bestätigte Aktivierung erfolgreich abgeschlossen wurde
- **THEN** zeigt die UI die Einrichtung als abgeschlossen
- **AND** verlangt sie keine zusätzliche Browserabnahme oder Abnahmebestätigung
