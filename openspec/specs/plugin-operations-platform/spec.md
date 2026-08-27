# plugin-operations-platform Specification

## Purpose

TBD - created by archiving change update-plugin-platform-for-generic-jobs-imports. Update Purpose after archive.
## Requirements
### Requirement: Plugin-Operations sind hostgeführte Plattformbeiträge

Das System SHALL generische Plugin-Jobs und strukturierte Importprofile als hostgeführte Plattformbeiträge modellieren.

#### Scenario: Plugin registriert Jobtypen und Importprofile deklarativ

- **WHEN** ein Plugin langlaufende Operationen oder strukturierte Importe anbieten will
- **THEN** registriert es dafür deklarative Jobtypen und Importprofile über den kanonischen Plugin-Vertrag
- **AND** es führt keine eigene parallele Plattform-Registry für dieselben Fähigkeiten ein

### Requirement: Jobtypen werden über den Plugin-Vertrag registriert

Das System SHALL fachliche Jobtypen über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert einen Jobtyp

- **WHEN** ein Plugin einen generischen Studio-Job anbieten will
- **THEN** enthält sein Beitrag mindestens eine technische Kennung, einen owning Namespace und den fachlichen Bezug
- **AND** Kollisionen oder Namespace-Verstöße werden bei der Host-Validierung deterministisch abgewiesen

### Requirement: Importprofile werden über den Plugin-Vertrag registriert

Das System SHALL strukturierte Importprofile über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert ein Importprofil

- **WHEN** ein Plugin einen strukturierten Import anbieten will
- **THEN** enthält das Importprofil mindestens eine technische Kennung, erlaubte Quellformate, Schema-/Mapping-Erwartungen und Validierungsmetadaten
- **AND** das Plugin registriert damit keine eigene Import-Runtime oder parallele Host-Oberfläche

### Requirement: Generische Studio-Jobs sind zentral persistent

Das System SHALL pluginübergreifende Jobs zentral im Studio-Postgres persistent führen.

#### Scenario: Generischer Job wird gestartet

- **WHEN** ein Host-Endpunkt einen pluginübergreifenden Job startet
- **THEN** wird der führende Jobdatensatz zentral in der Studio-Persistenz angelegt
- **AND** eine externe Fachdatenbank gilt dafür nicht als primärer Plattformvertrag

#### Scenario: Host führt Jobs über einen runner-agnostischen Plattformvertrag

- **WHEN** die Plattform einen generischen Plugin-Job ausführt
- **THEN** bleiben Plugin-Vertrag, API-Shape, Statusmodell und zentrale Persistenz unabhängig von einer konkreten Worker-Technologie
- **AND** eine erste interne Runner-Implementierung wie Graphile Worker bleibt hinter der hostgeführten Runtime austauschbar

### Requirement: Generische Studio-Jobs verwenden einen stabilen Grundstatusvertrag

Das System SHALL für generische pluginübergreifende Jobs einen stabilen Grundstatusvertrag bereitstellen.

#### Scenario: Jobstatus wird gelesen

- **WHEN** ein Client oder Plugin den Status eines generischen Jobs abfragt
- **THEN** verwendet das System einen stabilen Grundstatusvertrag mit mindestens `queued`, `running`, `succeeded`, `failed`
- **AND** weitere optionale Status wie `cancelled` bleiben zulässig, sind aber nicht für die erste Ausbaustufe verpflichtend

### Requirement: Generische Plugin-Operations-Endpunkte bleiben hostgeführt

Das System SHALL generische Plugin-Operations-Endpunkte nur als hostgeführte Runtime-Endpunkte publizieren.

#### Scenario: Job- oder Import-Endpunkt wird produktiv verwendet

- **WHEN** ein generischer Job- oder Import-Endpunkt produktiv erreichbar ist
- **THEN** wird er über den Host mit Validierung, Actor-Kontext, Rechteprüfung und Fehlervertrag ausgeführt
- **AND** das Plugin publiziert dafür keinen unabhängigen Laufzeit-Endpunkt außerhalb der Host-Runtime

#### Scenario: Host veröffentlicht initiale Start- und Status-Endpunkte

- **WHEN** die erste Ausbaustufe der Plattform produktiv bereitgestellt wird
- **THEN** veröffentlicht der Host mindestens einen Endpunkt zum Starten generischer Plugin-Jobs und einen Endpunkt zur Statusabfrage
- **AND** beide Endpunkte arbeiten auf demselben zentralen Jobdatensatz und demselben stabilen Statusvertrag

### Requirement: Optionale Host-UI-Anbindung ist kein Pflichtvollausbau

Das System SHALL erste UI-Andockpunkte für generische Jobs oder Importe erlauben, ohne dafür bereits einen vollständigen Monitoring- oder Wizard-Ausbau zu verlangen.

#### Scenario: Plattform wird ohne fertige Monitoring-Seite eingeführt

- **WHEN** die generische Plugin-Operations-Plattform eingeführt wird
- **THEN** darf sie zunächst ohne voll ausgebaute Monitoring-Oberfläche oder Import-Wizard bestehen
- **AND** Fachchanges können die Plattform trotzdem über den Host-Vertrag konsumieren

#### Scenario: Host führt einen ersten lesenden Jobs-Unterbereich unter Monitoring ein

- **WHEN** der Host einen ersten UI-Einstieg für generische Plugin-Operations-Jobs bereitstellt
- **THEN** darf dieser als gezielter Unterbereich `Monitoring > Jobs` umgesetzt werden
- **AND** er bleibt im ersten Schnitt auf lesende Listen- und Detailansichten beschränkt
- **AND** daraus entsteht noch kein verpflichtender Vollausbau einer allgemeinen Monitoring-Suite

### Requirement: Host veröffentlicht eine lesende Listenansicht für Plugin-Operations-Jobs

Das System SHALL für generische Plugin-Operations-Jobs eine hostgeführte Listenansicht mit separater Sicht auf aktive und historische Jobs bereitstellen.

#### Scenario: Monitoring zeigt aktive Jobs

- **WHEN** ein Operator die Jobliste im Tab `Aktiv` öffnet
- **THEN** zeigt das System laufende und retryende Jobs mit Status, Progress-Kurzsicht, letzter Aktivität und Runtime-Diagnostik an
- **AND** aktive Jobs werden periodisch aktualisiert, ohne dass die Historienansicht dieselbe Polling-Frequenz übernehmen muss

#### Scenario: Monitoring zeigt historische Jobs

- **WHEN** ein Operator den Tab `Historie` öffnet
- **THEN** zeigt das System abgeschlossene oder anderweitig historische Jobs getrennt von aktiven Jobs an
- **AND** die Historienansicht unterstützt mindestens Status-, Plugin- und Jobtyp-Filter sowie eine einfache Suche

### Requirement: Host stellt eine paginierte Jobs-Listen-API bereit

Das System SHALL für die Monitoring-Liste eine eigene hostgeführte Listen-API für Plugin-Operations-Jobs bereitstellen.

#### Scenario: Client lädt aktive Jobs über Listen-API

- **WHEN** ein Client die Jobliste für aktive Jobs lädt
- **THEN** kann er die Sicht explizit als `active` anfordern
- **AND** die Antwort enthält eine reduzierte Listenprojektion statt vollständiger Detaildatensätze

#### Scenario: Client filtert historische Jobs

- **WHEN** ein Client historische Jobs nach `status`, `pluginId`, `jobTypeId` oder einer einfachen Suche filtert
- **THEN** wertet der Host diese Filter serverseitig aus
- **AND** die Antwort bleibt paginiert und monitoringtauglich

### Requirement: Host bietet eigene Detailseiten für Plugin-Operations-Jobs

Das System SHALL für einzelne Plugin-Operations-Jobs eine eigene lesende Detailansicht mit technischer History bereitstellen.

#### Scenario: Operator öffnet Jobdetail

- **WHEN** ein Operator aus der Monitoring-Liste einen einzelnen Job öffnet
- **THEN** zeigt die Detailansicht Status, Progress, Runtime-Diagnostik, Ergebnis-/Fehlerpayload und technische Event-History
- **AND** die Detailansicht wird nicht als flüchtiges Inline-Panel erzwungen

#### Scenario: Jobdetail und aktive Kurzsicht dürfen strukturierte Fortschrittsdetails nutzen

- **WHEN** ein Plugin für einen laufenden generischen Job strukturierte Fortschrittsdetails wie Gesamtmenge, verarbeitete Menge oder aktuelle Phase meldet
- **THEN** speichert und liefert die Plattform diese Details über den bestehenden generischen Progress-Vertrag aus
- **AND** aktive Kurzsichten und Detailansichten dürfen daraus Prozentwerte und verständliche Fortschrittstexte ableiten
- **AND** der Plattformvertrag verlangt dafür kein plugin-spezifisches Sonderendpunktmodell

### Requirement: Interne Job-Runner verwenden getrennte Datenbank-Principals

Das System SHALL Datenbankmigration, App-Enqueue und Jobverarbeitung mit getrennten, minimal berechtigten Principals ausführen.

#### Scenario: App reiht einen generischen Job ein

- **WHEN** ein Host-Endpunkt einen generischen Studio-Job startet
- **THEN** darf der App-Principal den Job ohne allgemeine Datenbank- oder Schema-DDL-Rechte einreihen
- **AND** erfolgt das Einreihen über einen migrationsverwalteten, eingabevalidierenden `SECURITY DEFINER`-Wrapper mit festem `search_path`
- **AND** bleiben direkte Graphile-Funktionen und Queue-Tabellen für den App-Principal gesperrt
- **AND** führt der Request-Pfad keine Graphile-Worker-Migration aus

#### Scenario: Worker verarbeitet einen generischen Job

- **WHEN** der interne Runner einen eingereihten Job verarbeitet
- **THEN** verwendet er einen dedizierten Worker-Principal mit eigenem Datenbank-Pool
- **AND** erlauben ausschließlich schema-lokale RLS-Policies Claim, Lock und Abschluss auf den internen Graphile-Tabellen
- **AND** besitzt der Worker-Principal kein globales `BYPASSRLS`
- **AND** fällt er in produktionsnahen Profilen bei fehlender Worker-Konfiguration nicht auf den App-Principal zurück

#### Scenario: Queue-Schema ist nicht vorbereitet

- **WHEN** das erforderliche Graphile-Worker-Schema oder seine minimalen Grants fehlen
- **THEN** verhindert der kontrollierte Rollout den App-Deploy fail-closed
- **AND** versucht die laufende App keine selbstständige Schemaheilung

#### Scenario: Aktivierter Worker ist nicht lauffähig

- **WHEN** eine Runtime mit aktivierter Worker-Lane den Worker nicht starten kann oder der laufende Worker abbricht
- **THEN** meldet der Readiness-Endpunkt den Dienst `jobWorker` mit stabilem Reason-Code als nicht bereit
- **AND** protokolliert die Runtime den Start- oder Laufzeitfehler als Fehlerereignis
- **AND** bleibt eine ausdrücklich deaktivierte Worker-Lane readiness-neutral

### Requirement: Waste-Datenbankprovisionierung ist ein zentral persistenter Plugin-Operations-Job

Das System SHALL die tenantbezogene Waste-Datenbankprovisionierung als hostgeführten, namespaced und zentral persistent geführten Plugin-Operations-Job modellieren.

#### Scenario: Waste-Provisionierungsjob wird registriert

- **WHEN** `waste-management` seinen Provisionierungsbeitrag deklariert
- **THEN** registriert es den Jobtyp `waste-management.provision-tenant-database` über den kanonischen Plugin-Vertrag
- **AND** der führende Jobdatensatz liegt im zentralen Studio-Postgres
- **AND** die tenantbezogene Waste-Datenbank wird nicht zur führenden Persistenz dieses Plattformjobs

#### Scenario: Provisionierungsfortschritt wird gemeldet

- **WHEN** der Job Datenbank, Rollen, Interface, Migrationen oder Verbindungsprüfungen bearbeitet
- **THEN** projiziert er die aktuelle Phase und einen stabilen Status über den generischen Jobvertrag
- **AND** korreliert die Evidenz mindestens Instanz, Plugin und Jobtyp
- **AND** Fortschrittsdetails und Fehler enthalten keine Zugangsdaten oder Secret-Werte

#### Scenario: Derselbe Sollzustand wird mehrfach angefordert

- **WHEN** für dieselbe Instanz wiederholt eine Waste-Provisionierung angefordert wird
- **THEN** verhindert der Host konkurrierende aktive Provisionierungsjobs für denselben Sollzustand
- **AND** gibt er deterministisch den aktiven oder bereits erfolgreichen Lauf zurück oder startet einen expliziten Retry des fehlgeschlagenen Laufs
- **AND** die Ausführung bleibt auf Ebene jedes Provisionierungsschritts idempotent

### Requirement: Exportprofile werden über den Plugin-Vertrag registriert

Das System SHALL strukturierte Exportprofile über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert ein Exportprofil

- **WHEN** ein Plugin einen strukturierten Export anbieten will
- **THEN** enthält das Exportprofil mindestens eine technische Kennung, einen owning Namespace, das kanonische Datenprofil, erlaubte Zielformate sowie Schema-/Mappingversionen
- **AND** Kollisionen oder Namespace-Verstöße werden bei der Host-Validierung deterministisch abgewiesen

#### Scenario: Import- und Exportprofil teilen einen Datenvertrag

- **WHEN** ein Plugin dasselbe fachliche Datenprofil importieren und exportieren kann
- **THEN** referenzieren beide Richtungen denselben kanonischen Feld- und Versionsvertrag
- **AND** die Plattform erzwingt keine getrennte, driftanfällige Duplikation der Fachdatenstruktur

### Requirement: Generische Studio-Jobs können geschützte Ergebnisartefakte liefern

Das System SHALL generischen Plugin-Operations-Jobs geschützt herunterladbare Ergebnisartefakte zuordnen können.

#### Scenario: Exportjob erzeugt ein Ergebnisartefakt

- **WHEN** ein autorisierter Exportjob erfolgreich abgeschlossen wird
- **THEN** beschreibt sein Ergebnisartefakt mindestens Content-Type, sicheren Dateinamen, Größe, Prüfsumme und Ablauf
- **AND** der zentrale Jobdatensatz enthält keine eingebetteten Massendaten als Ersatz für das geschützte Artefakt

#### Scenario: Benutzer lädt ein Ergebnisartefakt herunter

- **WHEN** ein Benutzer ein Job-Ergebnisartefakt anfordert
- **THEN** prüft der Host Actor, Instanzkontext und erforderliche vollqualifizierte Action erneut
- **AND** liefert das Artefakt nur über eine zeitlich und fachlich begrenzte Downloadreferenz

#### Scenario: Ergebnisartefakt ist abgelaufen

- **WHEN** die Aufbewahrungsdauer eines Ergebnisartefakts abgelaufen ist
- **THEN** verweigert der Host den Download mit einem stabilen Fehlervertrag
- **AND** der Jobstatus bleibt ohne das Artefakt historisch nachvollziehbar

### Requirement: Worker-Nebenpfade sind korreliert und begrenzt beobachtbar

Das System MUST Fehler unabhängiger Worker-Nebenpfade wie Abbruchabfragen oder Persistenz eines Fehlerzustands mit Job-, Execution- oder vergleichbarer Ausführungskorrelation sichtbar machen. Diese Diagnose MUST den bestehenden fachlichen Kontrollfluss unverändert lassen und wiederholte identische Ereignisse aus pollenden Pfaden pro Ausführung und Fehlerzustand deduplizieren oder begrenzen.

#### Scenario: Abbruchabfrage schlägt während eines Jobs fehl

- **WHEN** die periodische Abbruchabfrage eines laufenden Jobs fehlschlägt
- **THEN** protokolliert der Worker ein strukturiertes sekundäres Ereignis mit Ausführungskorrelation, Operation, stabilem Fehlercode und Folgebehandlung
- **AND** setzt er den bestehenden Hauptkontrollfluss gemäß bisherigem Vertrag fort
- **AND** erzeugt er nicht bei jedem Poll-Zyklus dasselbe Warnereignis unbeschränkt erneut

#### Scenario: Fehlerzustand kann nicht persistiert werden

- **WHEN** der Worker nach einem primären Fehler den vorgesehenen Fehlerzustand nicht persistieren kann
- **THEN** protokolliert er den Persistenzfehler als separates sekundäres Ereignis
- **AND** bleibt das kanonische Ereignis des primären Jobfehlers eindeutig erkennbar

#### Scenario: Nebenpfad erholt sich

- **WHEN** ein zuvor fehlgeschlagener pollender Nebenpfad innerhalb derselben Ausführung wieder erfolgreich ist
- **THEN** darf der Worker genau ein korreliertes Recovery-Ereignis emittieren
- **AND** setzt er die Begrenzung für einen späteren neuen Fehlerzustand kontrolliert zurück

### Requirement: Plugin-Operations-Jobs liefern einen dauerhaften UI-Bezug

Die Plugin-Operations-Plattform MUST für angenommene Jobs eine stabile Job-ID und die für Fachkurzsicht, Monitoring und Detailansicht erforderlichen Status-, Progress-, Ergebnis- und Fehlerprojektionen bereitstellen.

#### Scenario: Fachbereich bindet einen gestarteten Job an

- **WHEN** ein Fachbereich einen generischen Plugin-Operations-Job startet
- **THEN** kann er den initialen Status und spätere Aktualisierungen über dieselbe stabile Job-ID laden
- **AND** muss das Plugin keinen parallelen Statusstore betreiben

### Requirement: Jobfolgeaktionen werden explizit als Hostvertrag exponiert

Die Plugin-Operations-Plattform MUST erlaubte Folgeaktionen wie Retry, Cancel, Ergebnisöffnung oder Download zustands- und berechtigungssicher über hostgeführte Verträge abbilden, bevor die UI sie anbietet.

#### Scenario: UI fragt zulässige Folgeaktionen ab

- **WHEN** ein Job in der Fachkurzsicht oder Detailansicht dargestellt wird
- **THEN** kann die UI aus dem Hostvertrag ableiten, welche Folgeaktionen im aktuellen Zustand zulässig sind
- **AND** erfindet sie keine Aktion allein aus einem Statusstring oder pluginlokaler Konvention
