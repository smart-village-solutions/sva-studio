## ADDED Requirements
### Requirement: Waste-Management ist eine vollständige Studio-Capability

Das System SHALL eine eigenständige Capability `waste-management` für die vollständige administrative Pflege des kommunalen Abfallkalenders bereitstellen.

#### Scenario: Waste-Management deckt den vollen Admin-Scope ab

- **WHEN** das Waste-Management-Modul im Studio verwendet wird
- **THEN** können Abfallarten, Regionen, Orte, Straßen, Hausnummern, Abholorte, Touren, Standort-Zuordnungen, globale Datumsverschiebungen und tourbezogene Datumsverschiebungen verwaltet werden
- **AND** das Modul umfasst CSV-Import, Seed, Reset und modulbezogene Einstellungen
- **AND** Feiertags- und sonstige Abweichungslogik ist Teil des fachlichen Scopes
- **AND** öffentliche Bürger-Read-APIs oder Export-Feeds sind nicht Teil dieser Capability

### Requirement: Waste-Management verwendet eine freie Plugin-Route

Das System SHALL Waste-Management als freies Plugin unter `/plugins/waste-management` materialisieren.

#### Scenario: Studio navigiert auf die Waste-Management-Hauptoberfläche

- **WHEN** ein berechtigter Benutzer `/plugins/waste-management` aufruft
- **THEN** rendert das Studio die modulare Waste-Management-Oberfläche innerhalb der normalen App-Shell
- **AND** die fachliche Hauptnavigation bleibt innerhalb des Plugin-Pfads
- **AND** der Hauptpfad wird nicht als host-owned `adminResource` materialisiert

### Requirement: Waste-Management verwendet typisierte Search-Params

Das System SHALL den fachlichen UI-Zustand des Waste-Management-Plugins über typisierte Search-Params abbilden, soweit er teilbar oder reload-stabil sein muss.

#### Scenario: Tab- und Filterzustand ist reload-stabil

- **WHEN** ein Benutzer im Waste-Management zwischen Tabs wechselt oder Filter und Suche nutzt
- **THEN** werden die relevanten Zustände über typisierte Search-Params serialisiert
- **AND** ein Reload oder Deep-Link stellt denselben fachlichen Kontext wieder her
- **AND** ungültige Werte werden auf einen kanonischen Defaultzustand normalisiert

#### Scenario: Fachliche Filter sind ausdrücklicher Teil des Admin-Vertrags

- **WHEN** Benutzer in Waste-Management-Listen nach Abfallarten, Orten, Touren, Status oder Abweichungskontexten filtern
- **THEN** bleiben diese Filter reproduzierbar, teilbar und reload-stabil
- **AND** der Listenvertrag hängt nicht ausschließlich an lokalem Komponenten-State

### Requirement: Waste-Management nutzt eine hostgeführte Server-Fassade

Das System SHALL alle Waste-Management-Datenzugriffe über eine hostgeführte Studio-Fassade unter `/api/v1/waste-management/*` kapseln.

#### Scenario: Plugin spricht keine Supabase-Schnittstelle direkt

- **WHEN** die Plugin-Oberfläche Waste-Management-Daten liest oder mutiert
- **THEN** spricht sie ausschließlich die Studio-Fassade unter `/api/v1/waste-management/*` an
- **AND** das Plugin importiert keinen direkten Supabase-Client
- **AND** das Plugin hängt nicht von `Newcms`-Edge-Functions als produktivem Vertrag ab

#### Scenario: Host-Fassade löst die Waste-Datenquelle pro Instanz serverseitig auf

- **WHEN** ein Request des Plugins Waste-Daten lesen oder mutieren will
- **THEN** bestimmt die Host-Fassade anhand des aktiven Instanzkontexts die hinterlegte Waste-Datenquelle
- **AND** die Datenbankverbindung wird serverseitig hergestellt
- **AND** das Plugin erhält keinen direkten Zugriff auf Datenbank-Credentials oder rohe Verbindungsdetails

### Requirement: Waste-Management verwendet die `waste_*`-Tabellenfamilie als Migrationsbasis

Das System SHALL die bestehende `waste_*`-Tabellenfamilie als Migrationsbasis für das Waste-Management nutzen, ohne sie als unveränderlichen Vertrag zu behandeln.

#### Scenario: Schema darf kontrolliert bereinigt werden

- **WHEN** das Studio das Waste-Management-Zielbild implementiert
- **THEN** bleibt die vorhandene `waste_*`-Tabellenfamilie die fachliche Grundlage
- **AND** inkompatible Bereinigungen oder Erweiterungen sind zulässig, wenn ein klarer Migrationspfad dokumentiert ist
- **AND** das Zielbild wird nicht durch die bestehende `Newcms`-Struktur technisch blockiert

### Requirement: Waste-Management trennt Studio-Governance von Waste-Fachdatenbanken

Das System SHALL zentrale Studio-Governance-Daten von instanzbezogenen Waste-Fachdatenbanken trennen.

#### Scenario: Studio-Postgres bleibt die zentrale Governance-Persistenz

- **WHEN** das Studio Rollen, Rechte, Audits oder technische Modulkonfigurationen für Waste-Management verwaltet
- **THEN** werden diese Daten in der zentralen Studio-Persistenz gehalten
- **AND** fachliche Waste-Massendaten werden dort nicht als reguläres Betriebsmodell mitgeführt

#### Scenario: Externe Waste-Datenbank speichert keine Studio-Governance-Primärdaten

- **WHEN** die externe Waste- oder Supabase-Datenbank einer Instanz für das Waste-Management verwendet wird
- **THEN** werden dort keine IAM-, Rollen-, Rechte- oder Audit-Primärdaten des Studios als führender Vertrag gespeichert
- **AND** diese Governance-Daten bleiben im zentralen Studio-Postgres verankert

#### Scenario: Studio darf zentrale Monitoring- und Historienmetadaten zur externen Datenquelle führen

- **WHEN** das Studio den Zustand, die Erreichbarkeit oder die Entwicklung der externen Waste-Datenquelle einer Instanz nachhalten will
- **THEN** dürfen zu dieser Datenquelle zentrale Status-, Monitoring- oder Historienmetadaten im Studio-Postgres gespeichert werden
- **AND** diese Metadaten ersetzen nicht die fachliche Waste-Datenhaltung in der externen Waste-Datenbank

#### Scenario: Studio führt eine fortlaufende Ereignishistorie zur externen Datenquelle

- **WHEN** Prüfungen, Verbindungsfehler, Rekonfigurationen, Migrationen oder vergleichbare technische Ereignisse rund um die externe Waste-Datenquelle auftreten
- **THEN** kann das Studio diese Ereignisse als fortlaufende Historie im Studio-Postgres protokollieren
- **AND** die Historie dient Monitoring, Betrieb und Nachvollziehbarkeit über die Zeit
- **AND** sie ersetzt nicht die plugininterne Job- oder Migrationspersistenz in der externen Waste-Datenbank

#### Scenario: Erste Pflichtmenge der zentralen Ereignishistorie ist definiert

- **WHEN** das Studio die externe Waste-Datenquelle einer Instanz zentral beobachtet
- **THEN** umfasst die erste verpflichtende Ereignishistorie mindestens erfolgreiche und fehlgeschlagene Connection-Checks
- **AND** sie umfasst Rekonfigurationen der Datenquelle
- **AND** sie umfasst jeweils Start, Erfolg und Fehler von Migration, CSV-Import, Seed und Reset

#### Scenario: Erste zentrale Historie bleibt technisch

- **WHEN** das Studio die erste verpflichtende Historie zur externen Waste-Datenquelle führt
- **THEN** beschränkt sich diese Historie zunächst auf technische Ereignisse
- **AND** fachliche Einordnungen oder weitergehende Business-Historien sind in diesem Change nicht verpflichtend

#### Scenario: Fehlgeschlagener Connection-Check setzt sofort einen sichtbaren aktuellen Status

- **WHEN** ein Connection-Check für die externe Waste-Datenquelle einer Instanz fehlschlägt
- **THEN** wird dieses Ereignis nicht nur zentral historisiert
- **AND** zusätzlich wird an der zentralen Instanz- oder Plugin-Konfiguration sofort ein sichtbarer aktueller Fehler- oder Störungsstatus gesetzt

#### Scenario: Erfolgreicher Connection-Check hebt den aktuellen Störungsstatus sofort auf

- **WHEN** ein nachfolgender Connection-Check für die externe Waste-Datenquelle erfolgreich ist
- **THEN** wird ein zuvor gesetzter sichtbarer aktueller Störungsstatus an der zentralen Instanz- oder Plugin-Konfiguration sofort aufgehoben
- **AND** die zentrale Historie behält den zeitlichen Verlauf der Störung dennoch bei

#### Scenario: Settings-Seite darf automatisch einen expliziten Connection-Check auslösen

- **WHEN** ein berechtigter Benutzer die Settings-Seite für die Waste-Datenquelle einer Instanz öffnet
- **THEN** darf das System automatisch einen expliziten Connection-Check für diese Datenquelle ausführen
- **AND** das Ergebnis darf den sichtbaren aktuellen Status unmittelbar aktualisieren

#### Scenario: Echte DB-Zugriffe dürfen den sichtbaren Status implizit aktualisieren

- **WHEN** reguläre Waste-Lese- oder Schreibzugriffe gegen die externe Datenquelle technisch erfolgreich oder wegen eines Connectivity-Problems fehlgeschlagen sind
- **THEN** darf das System daraus den sichtbaren aktuellen technischen Status der Datenquelle aktualisieren
- **AND** rein fachliche Fehler ohne Connectivity-Bezug setzen keinen Störungsstatus
- **AND** jeder technisch erfolgreiche echte DB-Zugriff darf den sichtbaren aktuellen Status unmittelbar wieder auf `ok` setzen

#### Scenario: Periodische Hintergrund-Checks sind nicht Teil dieses Changes

- **WHEN** das Studio die externe Waste-Datenquelle im Rahmen dieses Changes beobachtet
- **THEN** werden keine periodischen Hintergrund-Checks oder eigenständigen Monitoring-Scheduler als verpflichtender Bestandteil eingeführt

#### Scenario: Plugininterne Waste-Betriebsdaten dürfen in der externen Waste-Datenbank liegen

- **WHEN** das Waste-Management technische Hilfsdaten für Migrationen, asynchrone Jobs oder vergleichbare plugininterne Betriebsabläufe benötigt
- **THEN** dürfen diese Daten in der externen Waste- oder Supabase-Datenbank der Instanz gespeichert werden
- **AND** dadurch werden keine zentralen IAM-, Rollen-, Rechte-, Audit- oder Instanz-Governance-Daten des Studios aus dem Studio-Postgres verdrängt
- **AND** eine spätere generische Studio-Job-Persistenz im Studio-Postgres bleibt davon unberührt und wird dadurch nicht als führender Job-Vertrag ersetzt

#### Scenario: Jede Studio-Instanz besitzt ihre eigene Waste-Fachdatenbank

- **WHEN** Waste-Management für eine Studio-Instanz aktiviert wird
- **THEN** ist dieser Instanz genau eine eigene Waste-Fachdatenquelle zugeordnet
- **AND** fachliche Waste-Daten werden in dieser instanzbezogenen Datenbank gehalten
- **AND** andere Studio-Instanzen verwenden davon getrennte Waste-Fachdatenquellen

#### Scenario: Die Waste-Datenbank selbst bildet die Mandantengrenze

- **WHEN** fachliche Waste-Daten innerhalb der einer Instanz zugeordneten Waste-Fachdatenbank gespeichert oder gelesen werden
- **THEN** dient die Datenbank selbst als Mandantengrenze
- **AND** das Zielbild führt keinen zusätzlichen fachlichen `instance_id`-Mandantenschnitt als primären Vertrag in den Waste-Fachtabellen ein

### Requirement: Waste-Management erlaubt die instanzbezogene Konfiguration der Waste-Datenquelle

Das System SHALL für jede Studio-Instanz eine über Studio-Einstellungen pflegbare Waste-Datenquelle bereitstellen.

#### Scenario: Berechtigter Benutzer pflegt die Waste-Datenquelle über Studio-Einstellungen

- **WHEN** ein Benutzer mit `waste-management.settings.manage` die Modul-Einstellungen der aktiven Instanz bearbeitet
- **THEN** kann er die für diese Instanz vorgesehene genau eine Waste-Datenquelle konfigurieren oder aktualisieren
- **AND** die Änderung wird über die Host-Fassade verarbeitet
- **AND** die Verbindungsdaten werden im zentralen Studio-Postgres gehalten
- **AND** Secrets oder Zugangsdaten werden nicht im Browser offengelegt

#### Scenario: Studio validiert die konfigurierte Waste-Datenquelle nachvollziehbar

- **WHEN** für eine Instanz eine Waste-Datenquelle gespeichert oder aktualisiert wird
- **THEN** validiert das System die Konfiguration serverseitig
- **AND** Erfolg oder Fehler werden für den Benutzer nachvollziehbar rückgemeldet
- **AND** ungültige oder unvollständige Konfigurationen dürfen nicht stillschweigend aktiv werden

#### Scenario: Rekonfiguration bleibt bei nicht erreichbarer Datenquelle möglich

- **WHEN** die aktuell hinterlegte Waste-Datenquelle einer Instanz nicht mehr erreichbar ist, etwa nach einem Umzug der Supabase-Datenbank
- **THEN** bleibt mindestens der Settings-Pfad zur Datenquellenkonfiguration verfügbar
- **AND** ein berechtigter Benutzer kann die Verbindungsdaten serverseitig aktualisieren und erneut prüfen
- **AND** die Unerreichbarkeit der alten Datenquelle blockiert die Rekonfiguration nicht

### Requirement: `Newcms` darf nur als UX- und Fachreferenz portiert werden

Das System SHALL `Newcms` für Waste-Management nur als UX- und Fachreferenz oder als Quelle präsentationaler Artefakte nutzen, nicht als produktiven Laufzeitvertrag.

#### Scenario: Studio übernimmt die Informationsarchitektur, aber nicht die Runtime-Kopplung

- **WHEN** ein Team Teile der `Newcms`-Oberfläche für Waste-Management übernimmt oder eng nachbaut
- **THEN** dürfen Seitenzuschnitt, Tab-Struktur, Tabellenlayout, Filterführung, Dialogabfolgen und Feldgruppierungen fachlich oder visuell angelehnt sein
- **AND** produktive Routing-, Datenzugriffs-, Auth-, Audit- und Persistenzverträge werden ausschließlich über Studio-Packages hergestellt

#### Scenario: Portierte UI bleibt an Studio-Contracts gebunden

- **WHEN** präsentationale Komponenten oder lokale View-Model-Logik aus `Newcms` als Ausgangsmaterial dienen
- **THEN** werden sie auf Studio-Contracts für Routing, Host-API, Rechte, Audit und Instanzkontext umgestellt
- **AND** es verbleibt kein produktiver Laufzeitvertrag gegen `Newcms`

### Requirement: Waste-Management verbietet produktive `Newcms`-Runtime-Abhängigkeiten

Das System SHALL keine produktiven Runtime-, Hook-, Client- oder Datenmodell-Abhängigkeiten auf `Newcms` in die Studio-Umsetzung übernehmen.

#### Scenario: Direkte `Newcms`-Abhängigkeiten sind ausgeschlossen

- **WHEN** das Waste-Management-Plugin oder zugehörige Host-Packages gebaut oder ausgeführt werden
- **THEN** importieren sie keine `Newcms`-Hooks, keine `Newcms`-API-Clients und keine `Newcms`-Edge-Functions als produktiven Vertrag
- **AND** sie nutzen keine direkte Supabase-Anbindung aus `Newcms`

#### Scenario: Implizite Architekturannahmen aus `Newcms` werden nicht übernommen

- **WHEN** fachliche Logik oder Datenmodelle aus `Newcms` als Vorlage dienen
- **THEN** werden globale Datenannahmen, Singleton-Modelle, fehlende Instanzgrenzen oder `Newcms`-spezifische Zustandscontainer nicht stillschweigend mit übernommen
- **AND** die resultierende Studio-Umsetzung bleibt mit Instanzscoping, Host-Fassade und zentralem IAM/Audit konsistent

### Requirement: Jede Portierung aus `Newcms` wird auf Studio-Packages und Studio-Verträge gemappt

Das System SHALL für jedes wesentlich aus `Newcms` übernommene Artefakt eine explizite Zuordnung zu Studio-Packages und Studio-Verträgen herstellen.

#### Scenario: Portiertes Artefakt wird vor Umsetzung klassifiziert

- **WHEN** ein größeres UI-Element, ein Workflow oder fachliche Logik aus `Newcms` übernommen werden soll
- **THEN** wird dokumentiert, ob das Artefakt präsentational, fachlogisch oder infrastrukturell ist
- **AND** es wird einem Studio-Package mit klarer Verantwortung zugeordnet
- **AND** benötigte Ersetzungen für Routing, Datenzugriff, Rechte, Audit und Settings werden explizit benannt

#### Scenario: Ein Artefakt mit verdeckter Architekturkopplung wird nicht direkt portiert

- **WHEN** ein `Newcms`-Artefakt gleichzeitig UI und produktive Daten-, Rechte- oder Runtime-Annahmen enthält
- **THEN** wird es vor der Übernahme in präsentationale und architekturrelevante Teile zerlegt
- **AND** nur die zur Studio-Architektur passenden Teile dürfen direkt übernommen oder eng angelehnt werden
- **AND** die verbleibenden Teile werden gegen Studio-spezifische Implementierungen ersetzt

### Requirement: Waste-Management fokussiert in diesem Change den Primärmodus

Das System SHALL in diesem Change den Betrieb von SVA Studio als führendes Waste-System spezifizieren.

#### Scenario: Studio ist führendes Waste-System

- **WHEN** eine Instanz Waste-Daten originär im Studio pflegt
- **THEN** kann das Modul alle fachlichen Daten und Werkzeuge ohne externes führendes System bereitstellen
- **AND** Studio bleibt die operative Quelle für Waste-Management innerhalb dieser Instanz

#### Scenario: Sekundärer Fremdsystem-Modus bleibt vertagt

- **WHEN** später ein externer Primärsystem-Modus ergänzt werden soll
- **THEN** verbaut dieser Change die dafür nötigen Host-Boundaries nicht
- **AND** konkrete Schreib-, Konflikt- oder Synchronisationsregeln sind nicht Teil dieses Changes

### Requirement: Waste-Management bildet die Adresshierarchie fachlich explizit ab

Das System SHALL die für den Abfallkalender relevante Adresshierarchie aus Ort, Straße und Hausnummer ausdrücklich modellieren.

#### Scenario: Nachgelagerte Auswahl folgt der vorangehenden Adressstufe

- **WHEN** eine Adresse über Ort, Straße und Hausnummer aufgebaut oder zugeordnet wird
- **THEN** richtet sich die Auswahlmenge der nächsten Stufe nach der vorherigen Auswahl
- **AND** die Hierarchie bleibt für redaktionelle Pflege und spätere kanalbezogene Nutzung konsistent

#### Scenario: Hausnummer bleibt optional, wenn der fachliche Kontext es erlaubt

- **WHEN** eine Zuordnung oder Pflegeoperation nicht zwingend bis auf Hausnummerebene gehen muss
- **THEN** kann das Modell auf einer höheren Adressstufe verbleiben
- **AND** das System behandelt diese Teiladressierung als fachlich gültigen Zustand

### Requirement: Waste-Management unterstützt wiederkehrende Terminlogik mit Folgeeffekten

Das System SHALL wiederkehrende Tourtermine so modellieren, dass manuelle Einzelverschiebungen fachlich korrekt verarbeitet werden können.

#### Scenario: Einzelverschiebung betrifft nur den Einzeltermin

- **WHEN** ein wiederkehrender Tourtermin einmalig manuell verschoben wird
- **THEN** kann das System diese Korrektur als isolierte Ausnahme modellieren
- **AND** nachfolgende Termine bleiben unverändert, sofern die Fachregel dies vorsieht

#### Scenario: Einzelverschiebung beeinflusst Folgetermine

- **WHEN** eine manuelle Terminverschiebung laut Fachregel Auswirkungen auf die nachfolgende Terminserie haben soll
- **THEN** kann das System diesen Folgeeffekt ausdrücklich modellieren
- **AND** nachgelagerte Termine werden konsistent auf Basis der geänderten Serienlogik berechnet oder markiert

### Requirement: Waste-Management behandelt Feiertage und Abweichungen als erstklassige Fachlogik

Das System SHALL Feiertage und andere globale Abweichungsgründe als eigenständige Fachlogik für Terminverschiebungen behandeln.

#### Scenario: Feiertag löst globale Terminverschiebung aus

- **WHEN** ein Feiertag oder ein anderer globaler Abweichungsgrund einen regulären Tourtermin betrifft
- **THEN** kann das System diese Verschiebung explizit modellieren
- **AND** die daraus resultierende Terminlogik bleibt für betroffene Touren nachvollziehbar
- **AND** Feiertagsmanagement ist nicht nur als freier Text oder manueller Nebeneffekt abgebildet

### Requirement: Waste-Daten sind instanzbezogen isoliert

Das System SHALL Waste-Management-Daten im Zielbild instanzbezogen scopen.

#### Scenario: Instanzgrenze wird bei Lesezugriffen erzwungen

- **WHEN** ein Benutzer im Kontext einer aktiven Instanz Waste-Daten aufruft
- **THEN** werden nur Waste-Daten der aktiven Instanz gelesen
- **AND** Daten anderer Instanzen bleiben unsichtbar

#### Scenario: Instanzgrenze wird bei Mutationen erzwungen

- **WHEN** ein Benutzer Waste-Daten erstellt, ändert, importiert, Seed ausführt oder zurücksetzt
- **THEN** wirkt die Operation ausschließlich innerhalb der aktiven Instanz
- **AND** instanzfremde Datensätze dürfen dadurch nicht verändert werden

### Requirement: Waste-Management-Datenquellen und Migrationen bleiben administrierbar

Das System SHALL die instanzbezogene Waste-Datenquelle und deren Schema-Migrationsstand administrierbar halten.

#### Scenario: Plugin bietet Initialisierung oder Update-Migrationen an

- **WHEN** das Waste-Management-Plugin für eine Instanz erstmals gestartet wird oder nach einem Update feststellt, dass ausstehende Waste-Migrationen vorliegen
- **THEN** bietet das System die erforderliche Initialisierung oder Migration als explizite Admin-Operation an
- **AND** die Migration wird nicht als verdeckter Browser-Direktzugriff an Supabase ausgeführt

#### Scenario: Migrationen sind nachvollziehbare technische Operationen

- **WHEN** eine Waste-Migration für die aktive Instanz ausgeführt wird
- **THEN** ist deren Ergebnis für Administratoren nachvollziehbar
- **AND** Erfolg, Fehler oder ausstehender Status können über Studio-Verträge eingesehen werden

### Requirement: Waste-Management bildet Sicherheits- und Betriebszustände sichtbar ab

Das System SHALL für Waste-Management konsistente Lade-, Leer-, Fehler-, Berechtigungs- und Bestätigungszustände bereitstellen.

#### Scenario: Benutzer ohne Schreibrechte sieht nur lesenden Zustand

- **WHEN** ein Benutzer nur über `waste-management.read` verfügt
- **THEN** kann er fachliche Daten lesen
- **AND** schreibende Aktionen wie Erstellen, Bearbeiten, Import, Seed oder Reset sind verborgen oder deaktiviert

#### Scenario: Gefährliche Werkzeuge folgen separaten UI-Rechten

- **WHEN** ein Benutzer kein Spezialrecht für Seed oder Reset besitzt
- **THEN** erscheinen diese Werkzeuge nicht als reguläre verfügbare Aktionen
- **AND** die UI führt keinen alternativen Pfad an der serverseitigen Autorisierung vorbei ein

#### Scenario: Fehler aus der Host-Fassade werden benutzerführend dargestellt

- **WHEN** die Studio-Fassade eine fachliche oder technische Fehlerantwort für Waste-Management liefert
- **THEN** zeigt das Plugin einen Studio-konformen Fehlerzustand mit handlungsleitender Rückmeldung
- **AND** keine rohen Backend-Interna oder Stacktraces werden im UI offengelegt

#### Scenario: Nicht erreichbare Waste-Datenquelle führt in einen konfigurierbaren Fehlerzustand

- **WHEN** die Waste-Datenquelle der aktiven Instanz nicht erreichbar ist
- **THEN** zeigt das Plugin einen klaren technischen Fehlerzustand für fachliche Datenoperationen
- **AND** ein Benutzer mit `waste-management.settings.manage` wird zu einem Rekonfigurations- oder Prüfpfad geführt
- **AND** die Unerreichbarkeit führt nicht dazu, dass die technische Rekonfiguration der Datenquelle verborgen wird

### Requirement: Waste-Fachstammdaten unterstützen mehrsprachige und farbcodierte Darstellungen

Das System SHALL fachnahe Waste-Stammdaten für spätere mehrsprachige und visuelle Ausspielung vorbereiten.

#### Scenario: Abfallarten tragen mehrsprachige Bezeichnungen

- **WHEN** eine Abfallart oder vergleichbare fachliche Stammdaten gepflegt werden
- **THEN** können die fachlichen Bezeichnungen mehrsprachig verwaltet werden
- **AND** die Daten bleiben für unterschiedliche Kanäle konsistent nutzbar

#### Scenario: Farbcodes sind Teil des fachlichen Vertrags

- **WHEN** Abfallarten oder fachnahe Tourdarstellungen im System gepflegt werden
- **THEN** können ihnen definierte Farbcodes zugeordnet werden
- **AND** diese Farbcodes gelten als fachlich relevante Darstellungsinformation und nicht nur als lokale UI-Zierde

### Requirement: Waste-Management umfasst kontrollierte Data-Tools

Das System SHALL CSV-Import, Seed und Reset als kontrollierte Data-Tools im Waste-Management-Modul bereitstellen.

#### Scenario: Waste-Importe nutzen generische Studio-Importprofile

- **WHEN** das Waste-Management strukturierte Quelldaten importiert
- **THEN** nutzt es dafür eine allgemeine Studio-Import-Fähigkeit statt einer nur für Waste gebauten Sonderlösung
- **AND** Waste definiert dafür pluginseitige Importprofile statt eine eigene parallele Importplattform aufzubauen

#### Scenario: Generische Import-Fähigkeit wird als Plattformbasis aufgebaut

- **WHEN** das Studio die erste allgemeine Import-Fähigkeit im vorgelagerten Plattformchange bereitstellt
- **THEN** wird sie bereits als tragfähige Plattformbasis für weitere Plugins aufgebaut
- **AND** sie bleibt nicht nur eine schmale vorbereitende Sonderlösung für Waste allein

#### Scenario: Importprofile werden über einen expliziten Plugin-Vertrag registriert

- **WHEN** ein Plugin strukturierte Datenimporte über die allgemeine Studio-Import-Fähigkeit anbieten will
- **THEN** registriert es seine Importprofile über einen expliziten Plugin-Vertrag
- **AND** das Studio übernimmt darauf aufbauend die generische Runtime, UI und Orchestrierung

#### Scenario: Erste Waste-Importtypen sind getrennt spezifiziert

- **WHEN** der erste verbindliche Importumfang für Waste beschrieben wird
- **THEN** werden mindestens die getrennten Importprofile `geografie-abholorte`, `touren` und `ausweichtermine` vorgesehen
- **AND** weitere spätere Importprofile bleiben zulässig, sind in diesem Change aber noch nicht verpflichtend

#### Scenario: Jeder Waste-Importtyp besitzt eigenes Schema, Vorlage und Validierung

- **WHEN** ein Waste-Importprofil definiert wird
- **THEN** besitzt es ein eigenes explizites Spalten- oder Feldschema
- **AND** es bringt eine kanonische Vorlage mit Beispielspalten und bei Bedarf einer Beispieldatei mit
- **AND** es enthält eigene fachliche und technische Validierungsregeln

#### Scenario: Waste nutzt in diesem Change CSV und XLSX als erste produktive Importformate

- **WHEN** das Studio die erste produktive Importstrecke für Waste-Management in diesem Change bereitstellt
- **THEN** unterstützen die registrierten Waste-Importprofile mindestens CSV und XLSX als Quellformate
- **AND** XLSX wird als echte Tabellenquelle behandelt, nicht nur als umbenannte CSV-Datei
- **AND** weitere Quellformate wie JSON oder XML bleiben als Plattformerweiterung des vorgelagerten generischen Import-Changes architektonisch zulässig

#### Scenario: Erste Import-Oberfläche folgt einem mehrstufigen Wizard

- **WHEN** das Studio eine allgemeine Import-Oberfläche für die registrierten Host-Importverträge bereitstellt
- **THEN** führt sie Benutzer mindestens durch Quellwahl, Profilwahl, Mapping-Prüfung, Validierungsvorschau, Job-Start und Ergebnisansicht
- **AND** Waste kann diese allgemeine Bedienlogik anbinden
- **AND** bis zur Verfügbarkeit einer solchen Host-Oberfläche darf Waste eine fachnahe Bedienhülle nutzen, solange der generische Host-Vertrag nicht umgangen wird

#### Scenario: Import-Mapping darf automatische Vorschläge erzeugen

- **WHEN** ein Benutzer Quelldaten auf ein Waste-Importprofil abbildet
- **THEN** darf das Studio automatische Mapping-Vorschläge für Quellspalten oder Quellfelder erzeugen
- **AND** der Benutzer kann diese Vorschläge vor dem Import prüfen und manuell korrigieren

#### Scenario: Mapping-Vorlagen dürfen pro Instanz und Importprofil gespeichert werden

- **WHEN** Benutzer für wiederkehrende Importe ein manuell angepasstes Mapping erfolgreich verwenden
- **THEN** darf das Studio dieses Mapping als einfache Vorlage pro Instanz und Importprofil speichern
- **AND** spätere Importe dürfen diese Vorlage erneut verwenden, ohne dass in diesem Change bereits eine komplexe Versions- oder Freigabelogik verpflichtend wird

#### Scenario: KI-basierte Mapping-Vorschläge bleiben später integrierbar

- **WHEN** das Studio die erste automatische Mapping-Strecke für Importprofile bereitstellt
- **THEN** wird die Vorschlagslogik so gekapselt, dass später auch eine externe KI-basierte Mapping-Hilfe angeschlossen werden kann
- **AND** diese mögliche KI-Integration ist in diesem Change noch nicht als produktiver Bestandteil verpflichtend

#### Scenario: CSV-Import validiert Daten und meldet Fehler nachvollziehbar

- **WHEN** ein Benutzer einen CSV-Import für Waste-Daten ausführt
- **THEN** startet das System eine asynchrone Import-Operation
- **AND** der Import validiert die Daten fachlich und technisch
- **AND** importierte, übersprungene und fehlgeschlagene Datensätze können über einen nachvollziehbaren Status rückgemeldet werden

#### Scenario: Seed-Werkzeug ist gesondert geschützt

- **WHEN** ein Benutzer Seed-Daten laden möchte
- **THEN** ist das Werkzeug nur mit dem dafür vorgesehenen Spezialrecht verfügbar
- **AND** die Seed-Operation wirkt ausschließlich im aktiven Instanzkontext
- **AND** die Ausführung erfolgt als asynchrone Operation mit nachvollziehbarem Ergebnisstatus

#### Scenario: Reset verlangt explizite Hochrisiko-Bestätigung

- **WHEN** ein Benutzer einen Reset für Waste-Daten auslösen möchte
- **THEN** verlangt das System eine explizite Hochrisiko-Bestätigung mit sichtbarem Scope
- **AND** die Operation ist nur mit einem separaten Reset-Recht verfügbar
- **AND** auch in Produktionsumgebungen bleibt diese Schutzstrecke verbindlich
- **AND** der Reset bezieht sich nur auf Waste-Fachdaten der aktiven Instanz und nicht auf die technische Datenquellenkonfiguration im Studio-Postgres

#### Scenario: Migrationen werden als asynchrone Data-Tools behandelt

- **WHEN** ein Benutzer eine ausstehende Waste-Schema-Migration für die aktive Instanz anstößt
- **THEN** wird die Operation asynchron ausgeführt
- **AND** Start, Fortschritt, Erfolg oder Fehler können nachvollziehbar eingesehen werden

#### Scenario: Waste nutzt eine generische Studio-Job-Fähigkeit

- **WHEN** das Waste-Management langlaufende Operationen wie Migration, CSV-Import, Seed oder Reset ausführt
- **THEN** verwendet es dafür ein allgemeines Studio-Jobmodell statt einer nur für Waste gebauten Sonderlösung
- **AND** Waste liefert dabei nur plugin-spezifische Jobtypen oder Payloads auf dieser allgemeinen Studio-Fähigkeit

#### Scenario: Generische Job-Fähigkeit wird als Plattformbasis aufgebaut

- **WHEN** das Studio die erste allgemeine Job-Fähigkeit im vorgelagerten Plattformchange bereitstellt
- **THEN** wird sie bereits als tragfähige Plattformbasis für weitere Plugins aufgebaut
- **AND** sie bleibt nicht nur eine schmale vorbereitende Sonderlösung für Waste allein

#### Scenario: Jobtypen werden über einen expliziten Plugin-Vertrag registriert

- **WHEN** ein Plugin langlaufende Operationen über die allgemeine Studio-Job-Fähigkeit anbieten will
- **THEN** registriert es seine fachlichen Jobtypen über einen expliziten Plugin-Vertrag
- **AND** das Studio übernimmt darauf aufbauend die generische Runtime, Persistenz, UI und Orchestrierung

#### Scenario: Generische Studio-Jobs sind zentral im Studio-Postgres persistent

- **WHEN** das Studio pluginübergreifende langlaufende Jobs verwaltet
- **THEN** liegt deren zentrale Persistenz im Studio-Postgres
- **AND** diese allgemeine Job-Persistenz wird nicht als primärer Vertrag in externe Plugin-Datenbanken verlagert

#### Scenario: Erste feste Statusmenge der generischen Studio-Job-Fähigkeit ist definiert

- **WHEN** das Studio langlaufende Jobs für Waste oder spätere Plugins führt
- **THEN** umfasst die erste feste Statusmenge mindestens `queued`, `running`, `succeeded`, `failed`, `cancelled`

#### Scenario: Erste generische Studio-Jobs enthalten keine automatische Retry-Logik

- **WHEN** die erste Ausbaustufe der generischen Studio-Job-Fähigkeit langlaufende Operationen ausführt
- **THEN** enthält sie keine automatische Retry-Logik als Pflichtbestandteil
- **AND** mögliche Wiederholungsmechanismen bleiben späteren Erweiterungen vorbehalten

#### Scenario: Wiederholung erfolgt durch neuen Job statt Neustart eines bestehenden Jobs

- **WHEN** ein Job in der ersten Ausbaustufe fehlschlägt oder abgebrochen wurde
- **THEN** wird er nicht als derselbe Job erneut gestartet
- **AND** eine erneute Ausführung erfolgt bei Bedarf durch das Anlegen eines neuen Jobs

#### Scenario: `cancelled` ist zunächst nur als Status vorgesehen

- **WHEN** die erste Ausbaustufe der generischen Studio-Job-Fähigkeit das Statusmodell definiert
- **THEN** ist `cancelled` als Status bereits vorgesehen
- **AND** daraus folgt noch keine Pflicht, für alle Jobtypen bereits einen echten aktiven Abbruchpfad bereitzustellen

#### Scenario: Generische Studio-Jobs sind pluginübergreifend im UI sichtbar

- **WHEN** das Studio eine zentrale Host-Sicht für generische Jobs bereitstellt
- **THEN** können Waste-Jobs dort als pluginübergreifendes Studio-Konzept erscheinen
- **AND** die Waste-Capability bleibt dennoch nutzbar, auch wenn zunächst nur fachnahe Statusdarstellungen im Plugin vorhanden sind

#### Scenario: Erste zentrale Job-Sicht hängt unter `Monitoring`

- **WHEN** das Studio eine zentrale pluginübergreifende UI-Sicht für generische Jobs materialisiert
- **THEN** darf diese unter dem bestehenden Sidebar-Punkt `Monitoring` verankert werden
- **AND** die Waste-Capability hängt nicht zwingend von der sofortigen Verfügbarkeit dieser Seite ab
- **AND** ein späteres Desktop-Widget ist für diesen Change nicht verpflichtend

#### Scenario: Erste Monitoring-Sicht bleibt in ihrer Informationsarchitektur flexibel

- **WHEN** das Studio eine zentrale `Monitoring`-Sicht für Jobs und externe Datenquellen aufbaut
- **THEN** bleibt diese zunächst eine technische und temporäre Admin-Sicht
- **AND** sie darf initial Jobs, aktuellen technischen Datenquellenstatus und technische Ereignishistorie zeigen
- **AND** eine breitere fachliche Betriebsoberfläche wird in diesem Change nicht verpflichtend eingeführt

#### Scenario: Wiederverwendbare UI-Muster werden als allgemeine Studio-Bausteine geschnitten

- **WHEN** das Waste-Management neue UI für Import, Jobs, Bulk-Actions, Hochrisiko-Bestätigungen oder technische Statusanzeigen benötigt
- **THEN** werden diese Muster als allgemeine Studio-UI-Bausteine umgesetzt oder aus bestehenden allgemeinen Bausteinen abgeleitet
- **AND** sie verbleiben nicht als einmalige isolierte Sonderlösung im Waste-Plugin, sofern ihre Semantik fachneutral genug für weitere Plugins ist

#### Scenario: Fachliche Waste-Dialoge und Jahreskalender bleiben im Plugin

- **WHEN** die Waste-Oberfläche Jahreskalender, Touren-, Ausweichtermin-, Abholort-, Fraktions- oder Zuordnungsdialoge bereitstellt
- **THEN** bleiben diese Komponenten fachliche Bestandteile von `packages/plugin-waste-management`
- **AND** sie werden in diesem Change nicht als allgemeine Plugin-UI-Komponenten in die zentrale UI-Library verschoben
