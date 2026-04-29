## ADDED Requirements
### Requirement: Progressive Informationsarchitektur auf der Instanz-Detailseite

Das System MUST die Instanz-Detailseite unter `/admin/instances/:instanceId` so strukturieren, dass aktuelle Betriebsbewertung, Konfiguration, technische Diagnose und Historie nicht mehr als gleichrangiger Lang-Scrollbereich konkurrieren.

#### Scenario: Standardansicht priorisiert den aktuellen Operator-Kontext

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Seite zuerst eine kompakte Uebersicht mit aktuellem Gesamtzustand, den wichtigsten offenen Befunden und der naechsten primaeren Aktion
- **UND** enthaelt diese Uebersicht nicht mehrere gleichrangige Wiederholungen desselben Zustands in verschiedenen Card-Gruppen
- **UND** muss der Operator nicht zuerst Preflight, Keycloak-Status, Run-Historie und Formulare gleichzeitig interpretieren

#### Scenario: Uebersicht funktioniert wie ein operatives Cockpit

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Uebersicht mindestens Identitaet der Instanz, Gesamtstatus, Frische der dominanten Evidenz und den aktuell wichtigsten Handlungsaufruf
- **UND** ordnet die Seite Befunde vor Steuerung und Steuerung vor Historie an
- **UND** folgt der Erstblick dem Prinzip `overview first, anomalies second, controls third, history last`

#### Scenario: Sekundaerbereiche folgen progressiver Offenlegung

- **WENN** ein Operator tiefer in Konfiguration, Diagnose oder Historie einsteigen moechte
- **DANN** sind diese Informationen in klar getrennten Arbeitsbereichen wie Tabs, Panels oder gleichwertigen Sektionen erreichbar
- **UND** bleibt der aktuelle Uebersichtsblock visuell von diesen Sekundaerbereichen unterscheidbar
- **UND** fuehrt die Seite kein zweites konkurrierendes Gesamtlayout fuer dieselbe Instanz ein

#### Scenario: Historische Fehl-Laeufe wirken nicht wie ein aktueller Gesamtblocker

- **WENN** eine Instanz aktuell betriebsbereit oder strukturell gruen ist, aber aeltere fehlgeschlagene Provisioning-Laeufe besitzt
- **DANN** trennt die Detailseite den aktuellen Zustand klar von der historischen Run-Historie
- **UND** darf ein aelterer Fehl-Lauf nicht denselben visuellen Rang wie ein aktueller blockierender Befund erhalten
- **UND** bleibt die Historie fuer Diagnosezwecke explizit oeffenbar

#### Scenario: Aktionen sind hierarchisiert statt gleich laut

- **WENN** die Detailseite mehrere moegliche Bedienhandlungen anbietet
- **DANN** hebt die Seite genau eine Primaeraktion deutlich hervor
- **UND** gruppiert Spezial- oder Folgeaktionen sichtbar nachgeordnet
- **UND** vermeidet in der Standardansicht mehrere gleichgewichtete Aktionsbuttons ohne erkennbare Prioritaet

#### Scenario: Optische Gimmicks steigern Freude ohne Unruhe

- **WENN** die Detailseite visuelle Gimmicks oder Mikrointeraktionen einsetzt
- **DANN** unterstuetzen diese Blickfuehrung, Statusfeedback oder die wahrgenommene Hochwertigkeit der Bedienung
- **UND** bleiben sie dezent genug, um Incident- und Betriebsarbeit nicht zu stoeren
- **UND** uebersteuern sie weder Statusfarben noch Fokusindikatoren noch zentrale Textlesbarkeit

#### Scenario: Motion bleibt ruhig und zugaenglich

- **WENN** die Detailseite Animationen fuer laufende Prozesse, Statuswechsel oder Hover-Zustaende einsetzt
- **DANN** sind diese kurz, ruhig und fachlich begruendet
- **UND** respektieren sie bestehende Accessibility-Anforderungen wie reduzierte Bewegung oder gleichwertige statische Rueckmeldung

## MODIFIED Requirements
### Requirement: Tenant-IAM-Betriebsblock auf der Instanz-Detailseite

Das System MUST auf `/admin/instances/:instanceId` einen eigenen Tenant-IAM-Betriebsblock bereitstellen, der Konfiguration, Rechteprobe und Reconcile fuer die gewaehlte Instanz getrennt darstellt und sich in eine progressive Seitenstruktur einordnet.

#### Scenario: Instanz-Detailseite zeigt getrennte Tenant-IAM-Abschnitte

- **WENN** ein berechtigter Operator die Detailseite einer Instanz oeffnet
- **DANN** zeigt die Seite einen separaten Tenant-IAM-Bereich oder eine gleichwertige drill-down-faehige Tenant-IAM-Sicht
- **UND** sind dort mindestens `Konfiguration`, `Rechteprobe`, `Reconcile` und ein zusammengefasster Gesamtzustand sichtbar
- **UND** bleibt dieser Bereich vom bestehenden Keycloak-Setup- und Provisioning-Bereich unterscheidbar
- **UND** konkurriert er in der Standardansicht nicht gleichrangig mit Konfigurationsformularen, Historie und technischer Schrittliste

#### Scenario: Tenant-IAM-Befund enthaelt Diagnose und Korrelation

- **WENN** die Detailseite einen degradierten oder blockierten Tenant-IAM-Zustand zeigt
- **DANN** enthaelt die UI verstaendliche Diagnoseinformationen wie Fehlercode, letzten Prueflauf oder `requestId`
- **UND** kann ein Operator den Befund ohne Wechsel in eine andere Admin-Seite einordnen

#### Scenario: Tenant-IAM erscheint als Betriebsachse statt als konkurrierender Hauptblock

- **WENN** die Standardansicht der Instanz geladen wird
- **DANN** ist Tenant-IAM als eigenstaendige Betriebsachse sichtbar
- **UND** bleibt klar unterscheidbar, ob der Befund `Konfiguration`, `Zugriff` oder `Reconcile` betrifft
- **UND** konkurriert dieser Befund in der Uebersicht nicht gleichrangig mit Formularen, Vollhistorie und technischen Rohlisten

### Requirement: Tenant-IAM-Aktionen bleiben kontextbezogen und begrenzt

Das System MUST auf der Instanz-Detailseite nur fachlich sinnvolle Tenant-IAM-Aktionen anbieten, diese dem sichtbaren Befund zuordnen und sie gegenueber der primaeren Seitenaktion klar als Spezial- oder Folgeaktionen abstufen.

#### Scenario: Detailseite verknuepft bestehende Reparaturpfade gezielt

- **WENN** ein sichtbarer Tenant-IAM-Befund durch eine bestehende Aktion adressierbar ist
- **DANN** bietet die Detailseite genau diese Aktion kontextbezogen an
- **UND** kann sie dafuer bestehende Provisioning-, Secret-, Reset- oder Reconcile-Pfade nutzen
- **UND** werden irrelevante oder nicht wirksame Aktionen nicht vorgeschlagen

#### Scenario: Rechteprobe ist als eigene Operator-Aktion verfuegbar

- **WENN** ein Operator die tenantlokale IAM-Betriebsfaehigkeit gezielt pruefen moechte
- **DANN** bietet die Detailseite eine explizite Aktion fuer die Tenant-IAM-Rechteprobe an
- **UND** zeigt nach Abschluss den aktualisierten Access-Zustand im Tenant-IAM-Bereich

#### Scenario: Detailseite bleibt trotz Rechteprobe reaktionsfaehig

- **WENN** ein Operator die Instanz-Detailseite oeffnet, ohne eine Rechteprobe anzustossen
- **DANN** rendert die Seite den vorhandenen Tenant-IAM-Befund ohne blockierende Zusatzpruefung
- **UND** zeigt bei Bedarf klar an, dass die Rechteprobe gezielt ausgeloest werden kann

#### Scenario: UI zeigt unbestimmte Access-Lage ehrlich an

- **WENN** fuer `access` noch keine belastbare Rechteprobe oder aequivalente Access-Evidenz vorliegt
- **DANN** zeigt die Detailseite diesen Teilzustand als `unknown` oder fachlich gleichwertig an
- **UND** suggeriert nicht, dass aus einer gruenen Strukturpruefung bereits betriebliche Tenant-IAM-Rechte folgen
