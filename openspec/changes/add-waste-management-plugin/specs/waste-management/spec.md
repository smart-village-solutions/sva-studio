## ADDED Requirements
### Requirement: Waste-Management ist eine vollstaendige Studio-Capability

Das System SHALL eine eigenstaendige Capability `waste-management` fuer die vollstaendige administrative Pflege des kommunalen Abfallkalenders bereitstellen.

#### Scenario: Waste-Management deckt den vollen Admin-Scope ab

- **WHEN** das Waste-Management-Modul im Studio verwendet wird
- **THEN** koennen Muellarten, Regionen, Orte, Strassen, Hausnummern, Abholorte, Touren, Standort-Zuordnungen, globale Datumsverschiebungen und tourbezogene Datumsverschiebungen verwaltet werden
- **AND** das Modul umfasst CSV-Import, Seed, Reset und modulbezogene Einstellungen
- **AND** Feiertags- und sonstige Abweichungslogik ist Teil des fachlichen Scopes
- **AND** oeffentliche Buerger-Read-APIs oder Export-Feeds sind nicht Teil dieser Capability

### Requirement: Waste-Management verwendet eine freie Plugin-Route

Das System SHALL Waste-Management als freies Plugin unter `/plugins/waste-management` materialisieren.

#### Scenario: Studio navigiert auf die Waste-Management-Hauptoberflaeche

- **WHEN** ein berechtigter Benutzer `/plugins/waste-management` aufruft
- **THEN** rendert das Studio die modulare Waste-Management-Oberflaeche innerhalb der normalen App-Shell
- **AND** die fachliche Hauptnavigation bleibt innerhalb des Plugin-Pfads
- **AND** der Hauptpfad wird nicht als host-owned `adminResource` materialisiert

### Requirement: Waste-Management verwendet typisierte Search-Params

Das System SHALL den fachlichen UI-Zustand des Waste-Management-Plugins ueber typisierte Search-Params abbilden, soweit er teilbar oder reload-stabil sein muss.

#### Scenario: Tab- und Filterzustand ist reload-stabil

- **WHEN** ein Benutzer im Waste-Management zwischen Tabs wechselt oder Filter und Suche nutzt
- **THEN** werden die relevanten Zustaende ueber typisierte Search-Params serialisiert
- **AND** ein Reload oder Deep-Link stellt denselben fachlichen Kontext wieder her
- **AND** ungueltige Werte werden auf einen kanonischen Defaultzustand normalisiert

#### Scenario: Fachliche Filter sind ausdruecklicher Teil des Admin-Vertrags

- **WHEN** Benutzer in Waste-Management-Listen nach Abfallarten, Orten, Touren, Status oder Abweichungskontexten filtern
- **THEN** bleiben diese Filter reproduzierbar, teilbar und reload-stabil
- **AND** der Listenvertrag haengt nicht ausschliesslich an lokalem Komponenten-State

### Requirement: Waste-Management nutzt eine hostgefuehrte Server-Fassade

Das System SHALL alle Waste-Management-Datenzugriffe ueber eine hostgefuehrte Studio-Fassade unter `/api/v1/waste-management/*` kapseln.

#### Scenario: Plugin spricht keine Supabase-Schnittstelle direkt

- **WHEN** die Plugin-Oberflaeche Waste-Management-Daten liest oder mutiert
- **THEN** spricht sie ausschliesslich die Studio-Fassade unter `/api/v1/waste-management/*` an
- **AND** das Plugin importiert keinen direkten Supabase-Client
- **AND** das Plugin haengt nicht von `Newcms`-Edge-Functions als produktivem Vertrag ab

#### Scenario: Host-Fassade loest die Waste-Datenquelle pro Instanz serverseitig auf

- **WHEN** ein Request des Plugins Waste-Daten lesen oder mutieren will
- **THEN** bestimmt die Host-Fassade anhand des aktiven Instanzkontexts die hinterlegte Waste-Datenquelle
- **AND** die Datenbankverbindung wird serverseitig hergestellt
- **AND** das Plugin erhaelt keinen direkten Zugriff auf Datenbank-Credentials oder rohe Verbindungsdetails

### Requirement: Waste-Management verwendet die `waste_*`-Tabellenfamilie als Migrationsbasis

Das System SHALL die bestehende `waste_*`-Tabellenfamilie als Migrationsbasis fuer das Waste-Management nutzen, ohne sie als unveraenderlichen Vertrag zu behandeln.

#### Scenario: Schema darf kontrolliert bereinigt werden

- **WHEN** das Studio das Waste-Management-Zielbild implementiert
- **THEN** bleibt die vorhandene `waste_*`-Tabellenfamilie die fachliche Grundlage
- **AND** inkompatible Bereinigungen oder Erweiterungen sind zulaessig, wenn ein klarer Migrationspfad dokumentiert ist
- **AND** das Zielbild wird nicht durch die bestehende `Newcms`-Struktur technisch blockiert

### Requirement: Waste-Management trennt Studio-Governance von Waste-Fachdatenbanken

Das System SHALL zentrale Studio-Governance-Daten von instanzbezogenen Waste-Fachdatenbanken trennen.

#### Scenario: Studio-Postgres bleibt die zentrale Governance-Persistenz

- **WHEN** das Studio Rollen, Rechte, Audits oder technische Modulkonfigurationen fuer Waste-Management verwaltet
- **THEN** werden diese Daten in der zentralen Studio-Persistenz gehalten
- **AND** fachliche Waste-Massendaten werden dort nicht als regulaeres Betriebsmodell mitgefuehrt

#### Scenario: Externe Waste-Datenbank speichert keine Studio-Governance-Primärdaten

- **WHEN** die externe Waste- oder Supabase-Datenbank einer Instanz fuer das Waste-Management verwendet wird
- **THEN** werden dort keine IAM-, Rollen-, Rechte- oder Audit-Primärdaten des Studios als fuehrender Vertrag gespeichert
- **AND** diese Governance-Daten bleiben im zentralen Studio-Postgres verankert

#### Scenario: Studio darf zentrale Monitoring- und Historienmetadaten zur externen Datenquelle fuehren

- **WHEN** das Studio den Zustand, die Erreichbarkeit oder die Entwicklung der externen Waste-Datenquelle einer Instanz nachhalten will
- **THEN** duerfen zu dieser Datenquelle zentrale Status-, Monitoring- oder Historienmetadaten im Studio-Postgres gespeichert werden
- **AND** diese Metadaten ersetzen nicht die fachliche Waste-Datenhaltung in der externen Waste-Datenbank

#### Scenario: Studio fuehrt eine fortlaufende Ereignishistorie zur externen Datenquelle

- **WHEN** Pruefungen, Verbindungsfehler, Rekonfigurationen, Migrationen oder vergleichbare technische Ereignisse rund um die externe Waste-Datenquelle auftreten
- **THEN** kann das Studio diese Ereignisse als fortlaufende Historie im Studio-Postgres protokollieren
- **AND** die Historie dient Monitoring, Betrieb und Nachvollziehbarkeit ueber die Zeit
- **AND** sie ersetzt nicht die plugininterne Job- oder Migrationspersistenz in der externen Waste-Datenbank

#### Scenario: Erste Pflichtmenge der zentralen Ereignishistorie ist definiert

- **WHEN** das Studio die externe Waste-Datenquelle einer Instanz zentral beobachtet
- **THEN** umfasst die erste verpflichtende Ereignishistorie mindestens erfolgreiche und fehlgeschlagene Connection-Checks
- **AND** sie umfasst Rekonfigurationen der Datenquelle
- **AND** sie umfasst jeweils Start, Erfolg und Fehler von Migration, CSV-Import, Seed und Reset

#### Scenario: Erste zentrale Historie bleibt technisch

- **WHEN** das Studio die erste verpflichtende Historie zur externen Waste-Datenquelle fuehrt
- **THEN** beschraenkt sich diese Historie zunaechst auf technische Ereignisse
- **AND** fachliche Einordnungen oder weitergehende Business-Historien sind in diesem Change nicht verpflichtend

#### Scenario: Fehlgeschlagener Connection-Check setzt sofort einen sichtbaren aktuellen Status

- **WHEN** ein Connection-Check fuer die externe Waste-Datenquelle einer Instanz fehlschlaegt
- **THEN** wird dieses Ereignis nicht nur zentral historisiert
- **AND** zusaetzlich wird an der zentralen Instanz- oder Plugin-Konfiguration sofort ein sichtbarer aktueller Fehler- oder Stoerungsstatus gesetzt

#### Scenario: Erfolgreicher Connection-Check hebt den aktuellen Stoerungsstatus sofort auf

- **WHEN** ein nachfolgender Connection-Check fuer die externe Waste-Datenquelle erfolgreich ist
- **THEN** wird ein zuvor gesetzter sichtbarer aktueller Stoerungsstatus an der zentralen Instanz- oder Plugin-Konfiguration sofort aufgehoben
- **AND** die zentrale Historie behaelt den zeitlichen Verlauf der Stoerung dennoch bei

#### Scenario: Settings-Seite darf automatisch einen expliziten Connection-Check ausloesen

- **WHEN** ein berechtigter Benutzer die Settings-Seite fuer die Waste-Datenquelle einer Instanz oeffnet
- **THEN** darf das System automatisch einen expliziten Connection-Check fuer diese Datenquelle ausfuehren
- **AND** das Ergebnis darf den sichtbaren aktuellen Status unmittelbar aktualisieren

#### Scenario: Echte DB-Zugriffe duerfen den sichtbaren Status implizit aktualisieren

- **WHEN** regulaere Waste-Lese- oder Schreibzugriffe gegen die externe Datenquelle technisch erfolgreich oder wegen eines Connectivity-Problems fehlgeschlagen sind
- **THEN** darf das System daraus den sichtbaren aktuellen technischen Status der Datenquelle aktualisieren
- **AND** rein fachliche Fehler ohne Connectivity-Bezug setzen keinen Stoerungsstatus
- **AND** jeder technisch erfolgreiche echte DB-Zugriff darf den sichtbaren aktuellen Status unmittelbar wieder auf `ok` setzen

#### Scenario: Periodische Hintergrund-Checks sind nicht Teil dieses Changes

- **WHEN** das Studio die externe Waste-Datenquelle im Rahmen dieses Changes beobachtet
- **THEN** werden keine periodischen Hintergrund-Checks oder eigenstaendigen Monitoring-Scheduler als verpflichtender Bestandteil eingefuehrt

#### Scenario: Plugininterne Waste-Betriebsdaten duerfen in der externen Waste-Datenbank liegen

- **WHEN** das Waste-Management technische Hilfsdaten fuer Migrationen, asynchrone Jobs oder vergleichbare plugininterne Betriebsablaeufe benoetigt
- **THEN** duerfen diese Daten in der externen Waste- oder Supabase-Datenbank der Instanz gespeichert werden
- **AND** dadurch werden keine zentralen IAM-, Rollen-, Rechte-, Audit- oder Instanz-Governance-Daten des Studios aus dem Studio-Postgres verdraengt

#### Scenario: Jede Studio-Instanz besitzt ihre eigene Waste-Fachdatenbank

- **WHEN** Waste-Management fuer eine Studio-Instanz aktiviert wird
- **THEN** ist dieser Instanz genau eine eigene Waste-Fachdatenquelle zugeordnet
- **AND** fachliche Waste-Daten werden in dieser instanzbezogenen Datenbank gehalten
- **AND** andere Studio-Instanzen verwenden davon getrennte Waste-Fachdatenquellen

#### Scenario: Die Waste-Datenbank selbst bildet die Mandantengrenze

- **WHEN** fachliche Waste-Daten innerhalb der einer Instanz zugeordneten Waste-Fachdatenbank gespeichert oder gelesen werden
- **THEN** dient die Datenbank selbst als Mandantengrenze
- **AND** das Zielbild fuehrt keinen zusaetzlichen fachlichen `instance_id`-Mandantenschnitt als primaeren Vertrag in den Waste-Fachtabellen ein

### Requirement: Waste-Management erlaubt die instanzbezogene Konfiguration der Waste-Datenquelle

Das System SHALL fuer jede Studio-Instanz eine ueber Studio-Einstellungen pflegbare Waste-Datenquelle bereitstellen.

#### Scenario: Berechtigter Benutzer pflegt die Waste-Datenquelle ueber Studio-Einstellungen

- **WHEN** ein Benutzer mit `waste-management.settings.manage` die Modul-Einstellungen der aktiven Instanz bearbeitet
- **THEN** kann er die fuer diese Instanz vorgesehene genau eine Waste-Datenquelle konfigurieren oder aktualisieren
- **AND** die Aenderung wird ueber die Host-Fassade verarbeitet
- **AND** die Verbindungsdaten werden im zentralen Studio-Postgres gehalten
- **AND** Secrets oder Zugangsdaten werden nicht im Browser offengelegt

#### Scenario: Studio validiert die konfigurierte Waste-Datenquelle nachvollziehbar

- **WHEN** fuer eine Instanz eine Waste-Datenquelle gespeichert oder aktualisiert wird
- **THEN** validiert das System die Konfiguration serverseitig
- **AND** Erfolg oder Fehler werden fuer den Benutzer nachvollziehbar rueckgemeldet
- **AND** ungueltige oder unvollstaendige Konfigurationen duerfen nicht stillschweigend aktiv werden

#### Scenario: Rekonfiguration bleibt bei nicht erreichbarer Datenquelle moeglich

- **WHEN** die aktuell hinterlegte Waste-Datenquelle einer Instanz nicht mehr erreichbar ist, etwa nach einem Umzug der Supabase-Datenbank
- **THEN** bleibt mindestens der Settings-Pfad zur Datenquellenkonfiguration verfuegbar
- **AND** ein berechtigter Benutzer kann die Verbindungsdaten serverseitig aktualisieren und erneut pruefen
- **AND** die Unerreichbarkeit der alten Datenquelle blockiert die Rekonfiguration nicht

### Requirement: `Newcms` darf nur als UX- und Fachreferenz portiert werden

Das System SHALL `Newcms` fuer Waste-Management nur als UX- und Fachreferenz oder als Quelle praesentationaler Artefakte nutzen, nicht als produktiven Laufzeitvertrag.

#### Scenario: Studio uebernimmt die Informationsarchitektur, aber nicht die Runtime-Kopplung

- **WHEN** ein Team Teile der `Newcms`-Oberflaeche fuer Waste-Management uebernimmt oder eng nachbaut
- **THEN** duerfen Seitenzuschnitt, Tab-Struktur, Tabellenlayout, Filterfuehrung, Dialogabfolgen und Feldgruppierungen fachlich oder visuell angelehnt sein
- **AND** produktive Routing-, Datenzugriffs-, Auth-, Audit- und Persistenzvertraege werden ausschliesslich ueber Studio-Packages hergestellt

#### Scenario: Portierte UI bleibt an Studio-Contracts gebunden

- **WHEN** praesentationale Komponenten oder lokale View-Model-Logik aus `Newcms` als Ausgangsmaterial dienen
- **THEN** werden sie auf Studio-Contracts fuer Routing, Host-API, Rechte, Audit und Instanzkontext umgestellt
- **AND** es verbleibt kein produktiver Laufzeitvertrag gegen `Newcms`

### Requirement: Waste-Management verbietet produktive `Newcms`-Runtime-Abhaengigkeiten

Das System SHALL keine produktiven Runtime-, Hook-, Client- oder Datenmodell-Abhaengigkeiten auf `Newcms` in die Studio-Umsetzung uebernehmen.

#### Scenario: Direkte `Newcms`-Abhaengigkeiten sind ausgeschlossen

- **WHEN** das Waste-Management-Plugin oder zugehoerige Host-Packages gebaut oder ausgefuehrt werden
- **THEN** importieren sie keine `Newcms`-Hooks, keine `Newcms`-API-Clients und keine `Newcms`-Edge-Functions als produktiven Vertrag
- **AND** sie nutzen keine direkte Supabase-Anbindung aus `Newcms`

#### Scenario: Implizite Architekturannahmen aus `Newcms` werden nicht uebernommen

- **WHEN** fachliche Logik oder Datenmodelle aus `Newcms` als Vorlage dienen
- **THEN** werden globale Datenannahmen, Singleton-Modelle, fehlende Instanzgrenzen oder `Newcms`-spezifische Zustandscontainer nicht stillschweigend mit uebernommen
- **AND** die resultierende Studio-Umsetzung bleibt mit Instanzscoping, Host-Fassade und zentralem IAM/Audit konsistent

### Requirement: Jede Portierung aus `Newcms` wird auf Studio-Packages und Studio-Vertraege gemappt

Das System SHALL fuer jedes wesentlich aus `Newcms` uebernommene Artefakt eine explizite Zuordnung zu Studio-Packages und Studio-Vertraegen herstellen.

#### Scenario: Portiertes Artefakt wird vor Umsetzung klassifiziert

- **WHEN** ein groesseres UI-Element, ein Workflow oder fachliche Logik aus `Newcms` uebernommen werden soll
- **THEN** wird dokumentiert, ob das Artefakt praesentational, fachlogisch oder infrastrukturell ist
- **AND** es wird einem Studio-Package mit klarer Verantwortung zugeordnet
- **AND** benoetigte Ersetzungen fuer Routing, Datenzugriff, Rechte, Audit und Settings werden explizit benannt

#### Scenario: Ein Artefakt mit verdeckter Architekturkopplung wird nicht direkt portiert

- **WHEN** ein `Newcms`-Artefakt gleichzeitig UI und produktive Daten-, Rechte- oder Runtime-Annahmen enthaelt
- **THEN** wird es vor der Uebernahme in praesentationale und architekturrelevante Teile zerlegt
- **AND** nur die zur Studio-Architektur passenden Teile duerfen direkt uebernommen oder eng angelehnt werden
- **AND** die verbleibenden Teile werden gegen Studio-spezifische Implementierungen ersetzt

### Requirement: Waste-Management fokussiert in diesem Change den Primaermodus

Das System SHALL in diesem Change den Betrieb von SVA Studio als fuehrendes Waste-System spezifizieren.

#### Scenario: Studio ist fuehrendes Waste-System

- **WHEN** eine Instanz Waste-Daten originär im Studio pflegt
- **THEN** kann das Modul alle fachlichen Daten und Werkzeuge ohne externes fuehrendes System bereitstellen
- **AND** Studio bleibt die operative Quelle fuer Waste-Management innerhalb dieser Instanz

#### Scenario: Sekundaerer Fremdsystem-Modus bleibt vertagt

- **WHEN** spaeter ein externer Primaersystem-Modus ergaenzt werden soll
- **THEN** verbaut dieser Change die dafuer noetigen Host-Boundaries nicht
- **AND** konkrete Schreib-, Konflikt- oder Synchronisationsregeln sind nicht Teil dieses Changes

### Requirement: Waste-Management bildet die Adresshierarchie fachlich explizit ab

Das System SHALL die fuer den Abfallkalender relevante Adresshierarchie aus Ort, Strasse und Hausnummer ausdruecklich modellieren.

#### Scenario: Nachgelagerte Auswahl folgt der vorangehenden Adressstufe

- **WHEN** eine Adresse ueber Ort, Strasse und Hausnummer aufgebaut oder zugeordnet wird
- **THEN** richtet sich die Auswahlmenge der naechsten Stufe nach der vorherigen Auswahl
- **AND** die Hierarchie bleibt fuer redaktionelle Pflege und spaetere kanalbezogene Nutzung konsistent

#### Scenario: Hausnummer bleibt optional, wenn der fachliche Kontext es erlaubt

- **WHEN** eine Zuordnung oder Pflegeoperation nicht zwingend bis auf Hausnummerebene gehen muss
- **THEN** kann das Modell auf einer hoeheren Adressstufe verbleiben
- **AND** das System behandelt diese Teiladressierung als fachlich gueltigen Zustand

### Requirement: Waste-Management unterstuetzt wiederkehrende Terminlogik mit Folgeeffekten

Das System SHALL wiederkehrende Tourtermine so modellieren, dass manuelle Einzelverschiebungen fachlich korrekt verarbeitet werden koennen.

#### Scenario: Einzelverschiebung betrifft nur den Einzeltermin

- **WHEN** ein wiederkehrender Tourtermin einmalig manuell verschoben wird
- **THEN** kann das System diese Korrektur als isolierte Ausnahme modellieren
- **AND** nachfolgende Termine bleiben unveraendert, sofern die Fachregel dies vorsieht

#### Scenario: Einzelverschiebung beeinflusst Folgetermine

- **WHEN** eine manuelle Terminverschiebung laut Fachregel Auswirkungen auf die nachfolgende Terminserie haben soll
- **THEN** kann das System diesen Folgeeffekt ausdruecklich modellieren
- **AND** nachgelagerte Termine werden konsistent auf Basis der geaenderten Serienlogik berechnet oder markiert

### Requirement: Waste-Management behandelt Feiertage und Abweichungen als erstklassige Fachlogik

Das System SHALL Feiertage und andere globale Abweichungsgruende als eigenstaendige Fachlogik fuer Terminverschiebungen behandeln.

#### Scenario: Feiertag loest globale Terminverschiebung aus

- **WHEN** ein Feiertag oder ein anderer globaler Abweichungsgrund einen regulaeren Tourtermin betrifft
- **THEN** kann das System diese Verschiebung explizit modellieren
- **AND** die daraus resultierende Terminlogik bleibt fuer betroffene Touren nachvollziehbar
- **AND** Feiertagsmanagement ist nicht nur als freier Text oder manueller Nebeneffekt abgebildet

### Requirement: Waste-Daten sind instanzbezogen isoliert

Das System SHALL Waste-Management-Daten im Zielbild instanzbezogen scopen.

#### Scenario: Instanzgrenze wird bei Lesezugriffen erzwungen

- **WHEN** ein Benutzer im Kontext einer aktiven Instanz Waste-Daten aufruft
- **THEN** werden nur Waste-Daten der aktiven Instanz gelesen
- **AND** Daten anderer Instanzen bleiben unsichtbar

#### Scenario: Instanzgrenze wird bei Mutationen erzwungen

- **WHEN** ein Benutzer Waste-Daten erstellt, aendert, importiert, seeded oder zuruecksetzt
- **THEN** wirkt die Operation ausschliesslich innerhalb der aktiven Instanz
- **AND** instanzfremde Datensaetze duerfen dadurch nicht veraendert werden

### Requirement: Waste-Management-Datenquellen und Migrationen bleiben administrierbar

Das System SHALL die instanzbezogene Waste-Datenquelle und deren Schema-Migrationsstand administrierbar halten.

#### Scenario: Plugin bietet Initialisierung oder Update-Migrationen an

- **WHEN** das Waste-Management-Plugin fuer eine Instanz erstmals gestartet wird oder nach einem Update feststellt, dass ausstehende Waste-Migrationen vorliegen
- **THEN** bietet das System die erforderliche Initialisierung oder Migration als explizite Admin-Operation an
- **AND** die Migration wird nicht als verdeckter Browser-Direktzugriff an Supabase ausgefuehrt

#### Scenario: Migrationen sind nachvollziehbare technische Operationen

- **WHEN** eine Waste-Migration fuer die aktive Instanz ausgefuehrt wird
- **THEN** ist deren Ergebnis fuer Administratoren nachvollziehbar
- **AND** Erfolg, Fehler oder ausstehender Status koennen ueber Studio-Vertraege eingesehen werden

### Requirement: Waste-Management bildet Sicherheits- und Betriebszustaende sichtbar ab

Das System SHALL fuer Waste-Management konsistente Lade-, Leer-, Fehler-, Berechtigungs- und Bestaetigungszustaende bereitstellen.

#### Scenario: Benutzer ohne Schreibrechte sieht nur lesenden Zustand

- **WHEN** ein Benutzer nur ueber `waste-management.read` verfuegt
- **THEN** kann er fachliche Daten lesen
- **AND** schreibende Aktionen wie Erstellen, Bearbeiten, Import, Seed oder Reset sind verborgen oder deaktiviert

#### Scenario: Gefaehrliche Werkzeuge folgen separaten UI-Rechten

- **WHEN** ein Benutzer kein Spezialrecht fuer Seed oder Reset besitzt
- **THEN** erscheinen diese Werkzeuge nicht als regulaere verfuegbare Aktionen
- **AND** die UI fuehrt keinen alternativen Pfad an der serverseitigen Autorisierung vorbei ein

#### Scenario: Fehler aus der Host-Fassade werden benutzerfuehrend dargestellt

- **WHEN** die Studio-Fassade eine fachliche oder technische Fehlerantwort fuer Waste-Management liefert
- **THEN** zeigt das Plugin einen Studio-konformen Fehlerzustand mit handlungsleitender Rueckmeldung
- **AND** keine rohen Backend-Interna oder Stacktraces werden im UI offengelegt

#### Scenario: Nicht erreichbare Waste-Datenquelle fuehrt in einen konfigurierbaren Fehlerzustand

- **WHEN** die Waste-Datenquelle der aktiven Instanz nicht erreichbar ist
- **THEN** zeigt das Plugin einen klaren technischen Fehlerzustand fuer fachliche Datenoperationen
- **AND** ein Benutzer mit `waste-management.settings.manage` wird zu einem Rekonfigurations- oder Pruefpfad gefuehrt
- **AND** die Unerreichbarkeit fuehrt nicht dazu, dass die technische Rekonfiguration der Datenquelle verborgen wird

### Requirement: Waste-Fachstammdaten unterstuetzen mehrsprachige und farbcodierte Darstellungen

Das System SHALL fachnahe Waste-Stammdaten fuer spaetere mehrsprachige und visuelle Ausspielung vorbereiten.

#### Scenario: Abfallarten tragen mehrsprachige Bezeichnungen

- **WHEN** eine Abfallart oder vergleichbare fachliche Stammdaten gepflegt werden
- **THEN** koennen die fachlichen Bezeichnungen mehrsprachig verwaltet werden
- **AND** die Daten bleiben fuer unterschiedliche Kanaele konsistent nutzbar

#### Scenario: Farbcodes sind Teil des fachlichen Vertrags

- **WHEN** Abfallarten oder fachnahe Tourdarstellungen im System gepflegt werden
- **THEN** koennen ihnen definierte Farbcodes zugeordnet werden
- **AND** diese Farbcodes gelten als fachlich relevante Darstellungsinformation und nicht nur als lokale UI-Zierde

### Requirement: Waste-Management umfasst kontrollierte Data-Tools

Das System SHALL CSV-Import, Seed und Reset als kontrollierte Data-Tools im Waste-Management-Modul bereitstellen.

#### Scenario: Waste-Importe nutzen generische Studio-Importprofile

- **WHEN** das Waste-Management strukturierte Quelldaten importiert
- **THEN** nutzt es dafuer eine allgemeine Studio-Import-Faehigkeit statt einer nur fuer Waste gebauten Sonderloesung
- **AND** Waste definiert dafuer pluginseitige Importprofile statt eine eigene parallele Importplattform aufzubauen

#### Scenario: Generische Import-Faehigkeit wird als Plattformbasis aufgebaut

- **WHEN** das Studio die erste allgemeine Import-Faehigkeit in diesem Change bereitstellt
- **THEN** wird sie bereits als tragfaehige Plattformbasis fuer weitere Plugins aufgebaut
- **AND** sie bleibt nicht nur eine schmale vorbereitende Sonderloesung fuer Waste allein

#### Scenario: Importprofile werden ueber einen expliziten Plugin-Vertrag registriert

- **WHEN** ein Plugin strukturierte Datenimporte ueber die allgemeine Studio-Import-Faehigkeit anbieten will
- **THEN** registriert es seine Importprofile ueber einen expliziten Plugin-Vertrag
- **AND** das Studio uebernimmt darauf aufbauend die generische Runtime, UI und Orchestrierung

#### Scenario: Erste Waste-Importtypen sind getrennt spezifiziert

- **WHEN** der erste verbindliche Importumfang fuer Waste beschrieben wird
- **THEN** werden mindestens die getrennten Importprofile `geografie-abholorte`, `touren` und `ausweichtermine` vorgesehen
- **AND** weitere spaetere Importprofile bleiben zulaessig, sind in diesem Change aber noch nicht verpflichtend

#### Scenario: Jeder Waste-Importtyp besitzt eigenes Schema, Vorlage und Validierung

- **WHEN** ein Waste-Importprofil definiert wird
- **THEN** besitzt es ein eigenes explizites Spalten- oder Feldschema
- **AND** es bringt eine kanonische Vorlage mit Beispielspalten und bei Bedarf einer Beispieldatei mit
- **AND** es enthaelt eigene fachliche und technische Validierungsregeln

#### Scenario: Generische Import-Faehigkeit unterstuetzt mehrere Quellformate

- **WHEN** das Studio die erste allgemeine Import-Faehigkeit fuer Waste bereitstellt
- **THEN** unterstuetzt sie mindestens CSV, Excel sowie schema-nahe JSON- und XML-Quellen
- **AND** JSON und XML muessen dabei ohne komplexe ETL-Sonderlogik auf das jeweilige Importprofil abbildbar bleiben

#### Scenario: Erste Import-Oberflaeche folgt einem mehrstufigen Wizard

- **WHEN** das Studio die erste allgemeine Import-Oberflaeche fuer Waste bereitstellt
- **THEN** fuehrt sie Benutzer mindestens durch Quellwahl, Profilwahl, Mapping-Pruefung, Validierungsvorschau, Job-Start und Ergebnisansicht
- **AND** diese Bedienlogik wird als allgemeines Studio-Muster und nicht als einmaliger Waste-Sonderdialog aufgebaut

#### Scenario: Import-Mapping darf automatische Vorschlaege erzeugen

- **WHEN** ein Benutzer Quelldaten auf ein Waste-Importprofil abbildet
- **THEN** darf das Studio automatische Mapping-Vorschlaege fuer Quellspalten oder Quellfelder erzeugen
- **AND** der Benutzer kann diese Vorschlaege vor dem Import pruefen und manuell korrigieren

#### Scenario: Mapping-Vorlagen duerfen pro Instanz und Importprofil gespeichert werden

- **WHEN** Benutzer fuer wiederkehrende Importe ein manuell angepasstes Mapping erfolgreich verwenden
- **THEN** darf das Studio dieses Mapping als einfache Vorlage pro Instanz und Importprofil speichern
- **AND** spaetere Importe duerfen diese Vorlage erneut verwenden, ohne dass in diesem Change bereits eine komplexe Versions- oder Freigabelogik verpflichtend wird

#### Scenario: KI-basierte Mapping-Vorschlaege bleiben spaeter integrierbar

- **WHEN** das Studio die erste automatische Mapping-Strecke fuer Importprofile bereitstellt
- **THEN** wird die Vorschlagslogik so gekapselt, dass spaeter auch eine externe KI-basierte Mapping-Hilfe angeschlossen werden kann
- **AND** diese moegliche KI-Integration ist in diesem Change noch nicht als produktiver Bestandteil verpflichtend

#### Scenario: CSV-Import validiert Daten und meldet Fehler nachvollziehbar

- **WHEN** ein Benutzer einen CSV-Import fuer Waste-Daten ausfuehrt
- **THEN** startet das System eine asynchrone Import-Operation
- **AND** der Import validiert die Daten fachlich und technisch
- **AND** importierte, uebersprungene und fehlgeschlagene Datensaetze koennen ueber einen nachvollziehbaren Status rueckgemeldet werden

#### Scenario: Seed-Werkzeug ist gesondert geschuetzt

- **WHEN** ein Benutzer Seed-Daten laden moechte
- **THEN** ist das Werkzeug nur mit dem dafuer vorgesehenen Spezialrecht verfuegbar
- **AND** die Seed-Operation wirkt ausschliesslich im aktiven Instanzkontext
- **AND** die Ausfuehrung erfolgt als asynchrone Operation mit nachvollziehbarem Ergebnisstatus

#### Scenario: Reset verlangt explizite Hochrisiko-Bestaetigung

- **WHEN** ein Benutzer einen Reset fuer Waste-Daten ausloesen moechte
- **THEN** verlangt das System eine explizite Hochrisiko-Bestaetigung mit sichtbarem Scope
- **AND** die Operation ist nur mit einem separaten Reset-Recht verfuegbar
- **AND** auch in Produktionsumgebungen bleibt diese Schutzstrecke verbindlich
- **AND** der Reset bezieht sich nur auf Waste-Fachdaten der aktiven Instanz und nicht auf die technische Datenquellenkonfiguration im Studio-Postgres

#### Scenario: Migrationen werden als asynchrone Data-Tools behandelt

- **WHEN** ein Benutzer eine ausstehende Waste-Schema-Migration fuer die aktive Instanz anstoesst
- **THEN** wird die Operation asynchron ausgefuehrt
- **AND** Start, Fortschritt, Erfolg oder Fehler koennen nachvollziehbar eingesehen werden

#### Scenario: Waste nutzt eine generische Studio-Job-Faehigkeit

- **WHEN** das Waste-Management langlaufende Operationen wie Migration, CSV-Import, Seed oder Reset ausfuehrt
- **THEN** verwendet es dafuer ein allgemeines Studio-Jobmodell statt einer nur fuer Waste gebauten Sonderloesung
- **AND** Waste liefert dabei nur plugin-spezifische Jobtypen oder Payloads auf dieser allgemeinen Studio-Faehigkeit

#### Scenario: Generische Job-Faehigkeit wird als Plattformbasis aufgebaut

- **WHEN** das Studio die erste allgemeine Job-Faehigkeit in diesem Change bereitstellt
- **THEN** wird sie bereits als tragfaehige Plattformbasis fuer weitere Plugins aufgebaut
- **AND** sie bleibt nicht nur eine schmale vorbereitende Sonderloesung fuer Waste allein

#### Scenario: Jobtypen werden ueber einen expliziten Plugin-Vertrag registriert

- **WHEN** ein Plugin langlaufende Operationen ueber die allgemeine Studio-Job-Faehigkeit anbieten will
- **THEN** registriert es seine fachlichen Jobtypen ueber einen expliziten Plugin-Vertrag
- **AND** das Studio uebernimmt darauf aufbauend die generische Runtime, Persistenz, UI und Orchestrierung

#### Scenario: Generische Studio-Jobs sind zentral im Studio-Postgres persistent

- **WHEN** das Studio pluginuebergreifende langlaufende Jobs verwaltet
- **THEN** liegt deren zentrale Persistenz im Studio-Postgres
- **AND** diese allgemeine Job-Persistenz wird nicht als primaerer Vertrag in externe Plugin-Datenbanken verlagert

#### Scenario: Erste feste Statusmenge der generischen Studio-Job-Faehigkeit ist definiert

- **WHEN** das Studio langlaufende Jobs fuer Waste oder spaetere Plugins fuehrt
- **THEN** umfasst die erste feste Statusmenge mindestens `queued`, `running`, `succeeded`, `failed`, `cancelled`

#### Scenario: Erste generische Studio-Jobs enthalten keine automatische Retry-Logik

- **WHEN** die erste Ausbaustufe der generischen Studio-Job-Faehigkeit langlaufende Operationen ausfuehrt
- **THEN** enthaelt sie keine automatische Retry-Logik als Pflichtbestandteil
- **AND** moegliche Wiederholungsmechanismen bleiben spaeteren Erweiterungen vorbehalten

#### Scenario: Wiederholung erfolgt durch neuen Job statt Neustart eines bestehenden Jobs

- **WHEN** ein Job in der ersten Ausbaustufe fehlschlaegt oder abgebrochen wurde
- **THEN** wird er nicht als derselbe Job erneut gestartet
- **AND** eine erneute Ausfuehrung erfolgt bei Bedarf durch das Anlegen eines neuen Jobs

#### Scenario: `cancelled` ist zunaechst nur als Status vorgesehen

- **WHEN** die erste Ausbaustufe der generischen Studio-Job-Faehigkeit das Statusmodell definiert
- **THEN** ist `cancelled` als Status bereits vorgesehen
- **AND** daraus folgt noch keine Pflicht, fuer alle Jobtypen bereits einen echten aktiven Abbruchpfad bereitzustellen

#### Scenario: Generische Studio-Jobs sind pluginuebergreifend im UI sichtbar

- **WHEN** das Studio die erste Ausbaustufe seiner generischen Job-Faehigkeit bereitstellt
- **THEN** ist diese nicht nur technisch, sondern auch UI-seitig als pluginuebergreifendes Studio-Konzept sichtbar
- **AND** Waste-Jobs erscheinen damit nicht ausschliesslich als isolierte plugininterne Sonderdarstellung

#### Scenario: Erste zentrale Job-Sicht haengt unter `Monitoring`

- **WHEN** das Studio die erste pluginuebergreifende UI-Sicht fuer generische Jobs bereitstellt
- **THEN** wird diese unter dem bestehenden Sidebar-Punkt `Monitoring` verankert
- **AND** ein spaeteres Desktop-Widget ist fuer diesen Change nicht verpflichtend

#### Scenario: Erste Monitoring-Sicht bleibt in ihrer Informationsarchitektur flexibel

- **WHEN** das Studio die erste zentrale `Monitoring`-Sicht fuer Jobs und externe Datenquellen aufbaut
- **THEN** bleibt diese zunaechst eine technische und temporaere Admin-Sicht
- **AND** sie darf initial Jobs, aktuellen technischen Datenquellenstatus und technische Ereignishistorie zeigen
- **AND** eine breitere fachliche Betriebsoberflaeche wird in diesem Change nicht verpflichtend eingefuehrt

#### Scenario: Wiederverwendbare UI-Muster werden als allgemeine Studio-Bausteine geschnitten

- **WHEN** das Waste-Management neue UI fuer Import, Jobs, Bulk-Actions, Hochrisiko-Bestaetigungen oder technische Statusanzeigen benoetigt
- **THEN** werden diese Muster als allgemeine Studio-UI-Bausteine umgesetzt oder aus bestehenden allgemeinen Bausteinen abgeleitet
- **AND** sie verbleiben nicht als einmalige isolierte Sonderloesung im Waste-Plugin, sofern ihre Semantik fachneutral genug fuer weitere Plugins ist

#### Scenario: Fachliche Waste-Dialoge und Jahreskalender bleiben im Plugin

- **WHEN** die Waste-Oberflaeche Jahreskalender, Touren-, Ausweichtermin-, Abholort-, Fraktions- oder Zuordnungsdialoge bereitstellt
- **THEN** bleiben diese Komponenten fachliche Bestandteile von `packages/plugin-waste-management`
- **AND** sie werden in diesem Change nicht als allgemeine Plugin-UI-Komponenten in die zentrale UI-Library verschoben
