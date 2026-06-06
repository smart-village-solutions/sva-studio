## MODIFIED Requirements
### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailoberflaeche entlang von Lebensphase und
Arbeitsmodus strukturieren. Nach abgeschlossenem Setup darf die
Bestandsverwaltung nicht mehr als fortgesetztes Setup erscheinen. Fuer
vollstaendig eingerichtete Instanzen besteht die Hauptoberflaeche aus einem
kompakten Kopf und den drei dauerhaften Modi `Betrieb`, `Doctor` und
`Einstellungen`.

#### Scenario: Bestandsinstanz oeffnet standardmaessig im Betrieb

- **WENN** eine Instanz fachlich fertig eingerichtet ist
- **UND** ein berechtigter Operator `/admin/instances/:instanceId` oeffnet
- **DANN** oeffnet die Seite standardmaessig im Modus `Betrieb`
- **UND** bleibt die Modulverwaltung der primäre Happy Path
- **UND** konkurrieren Konfigurationsformular, Vollhistorie und
  Setup-Steuerung nicht gleichrangig im Erstblick

#### Scenario: Bestandsseite besitzt dauerhafte Modi statt gemischter Langseite

- **WENN** ein berechtigter Operator die Bestandsseite einer Instanz oeffnet
- **DANN** zeigt der Kopf mindestens Instanzidentitaet, `Setup-Status`,
  `Betriebsstatus` und einen festen Einstieg `Doctor öffnen`
- **UND** sind die Modi `Betrieb`, `Doctor` und `Einstellungen` dauerhaft
  erreichbar
- **UND** ist die technische Historie kein gleichrangiger Hauptmodus mehr

#### Scenario: Betrieb bleibt ruhig und fokussiert

- **WENN** die Bestandsseite im Modus `Betrieb` angezeigt wird
- **DANN** priorisiert die Oberflaeche Modulzuweisung, Modulentzug und
  alltaegliche Betriebsaktionen
- **UND** bleibt Diagnose nur ueber denselben festen Einstieg `Doctor öffnen`
  schnell erreichbar
- **UND** dominiert die Diagnoseansicht den Happy Path nicht dauerhaft

### Requirement: Tenant-IAM-Betriebsblock auf der Instanz-Detailseite

Das System MUST Tenant-IAM-Befunde im Bestandsbetrieb sichtbar halten, ohne die
Bestandsseite wieder in mehrere gleichrangige technische Hauptbloecke zu
zerlegen. Tenant-IAM-Konfiguration, Rechteprobe und Reconcile sollen im
Bestandsbetrieb und im Doctor-Modus konsistent auffindbar sein.

#### Scenario: Tenant-IAM bleibt im Betrieb sichtbar, aber nicht als zweites Cockpit

- **WENN** die Bestandsseite im Modus `Betrieb` geladen wird
- **DANN** bleibt ein Tenant-IAM-Befund als betriebliche Achse sichtbar
- **UND** ist weiterhin unterscheidbar, ob ein Befund `Konfiguration`,
  `Zugriff` oder `Reconcile` betrifft
- **UND** tritt dieser Befund nicht als konkurrierende zweite
  Langscroll-Diagnoseflaeche neben Modulverwaltung und Stammdaten auf

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST einen dauerhaft sichtbaren Einstieg `Doctor öffnen` auf der
Bestandsseite bereitstellen. Diagnose- und Reparaturaktionen werden ueber einen
gefuehrten Doctor-Modus angeboten, statt als ungeordnete Menge gleichrangiger
Buttons im Bestandsbetrieb aufzutreten.

#### Scenario: Doctor-Einstieg ist immer sichtbar

- **WENN** ein berechtigter Operator eine Bestandsinstanz oeffnet
- **DANN** ist `Doctor öffnen` immer an derselben Stelle sichtbar
- **UND** kann der Operator Diagnose auch dann aktiv starten, wenn das System
  keinen Befund automatisch erkannt hat

#### Scenario: Erkanntes Problem verstaerkt denselben Doctor-Einstieg

- **WENN** das System selbst einen degradierten oder blockierten Befund erkennt
- **DANN** darf die Bestandsseite im Kopf einen Warnkontext fuer denselben
  Einstieg `Doctor öffnen` anzeigen
- **UND** bleibt der Einstieg an derselben Position
- **UND** muss der Operator kein neues Interaktionsmuster fuer Fehlerfaelle
  lernen

#### Scenario: Doctor fuehrt durch Diagnose und Reparatur

- **WENN** ein Operator den Modus `Doctor` oeffnet
- **DANN** zeigt die Oberflaeche einen gefuehrten Ablauf aus `Überblick`,
  `Empfohlene Maßnahme`, `Reparatur ausführen` und `Validieren`
- **UND** enthaelt der Schritt `Überblick` bewusst auch gruene Vorbedingungen
- **UND** wird der Operator nicht direkt in tiefe Reparaturaktionen geworfen

### Requirement: Instanz-Anlage-Flow fuehrt einen gefuehrten Admin-Bootstrap-Abschnitt

Das System SHALL die Instanz-Anlage klar von der spaeteren Bestandsverwaltung
trennen. Nach erfolgreicher Anlage fuehrt der primaere naechste Schritt in
einen separaten einmaligen Flow `Setup abschliessen`, statt direkt in die
normale Bestandsseite zu springen.

#### Scenario: Erfolgreiche Anlage fuehrt zuerst in den Setup-Abschluss

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den primaeren naechsten Schritt ausloest
- **THEN** fuehrt die UI zuerst in einen separaten Flow
  `Setup abschliessen`
- **AND** ist die normale Bestandsseite noch nicht der primaere Zielbildschirm

#### Scenario: Stammdaten bleiben im Bestand nachgeordnet

- **GIVEN** das Setup einer Instanz wurde erfolgreich abgeschlossen
- **WHEN** ein Operator spaeter Vertrags- oder Stammdaten aendern moechte
- **THEN** findet er diese Aenderungen im Modus `Einstellungen`
- **AND** nicht mehr in der Hauptarbeitsflaeche des Bestandsbetriebs
