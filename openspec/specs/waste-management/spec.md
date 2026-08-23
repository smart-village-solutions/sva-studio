# waste-management Specification
## Purpose
TBD - created by archiving change add-waste-management-plugin. Update Purpose after archive.
## Requirements
### Requirement: Waste-Management ist eine vollständige Studio-Capability

Das System SHALL eine eigenständige Capability `waste-management` für die vollständige administrative Pflege des kommunalen Abfallkalenders bereitstellen.

#### Scenario: Waste-Management deckt den vollen Admin-Scope ab

- **WHEN** das Waste-Management-Modul im Studio verwendet wird
- **THEN** können Abfallarten, Regionen, Orte, Straßen, Hausnummern, Abholorte, Touren, Standort-Zuordnungen, globale Datumsverschiebungen und tourbezogene Datumsverschiebungen verwaltet werden
- **AND** das Modul umfasst CSV-Import, Seed, Reset und modulbezogene Einstellungen
- **AND** Feiertags- und sonstige Abweichungslogik ist Teil des fachlichen Scopes
- **AND** öffentliche Bürger-Read-APIs oder Export-Feeds sind nicht Teil dieser Capability
- **AND** die Capability erzeugt keine Bürger-PDFs mehr selbst

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

### Requirement: Waste-Management pflegt PDF-Stamminhalte, erzeugt aber keine PDFs

Das System SHALL den Tab `Ausgabe` im Waste-Management auf die Pflege statischer PDF-Inhalte begrenzen und keine operative PDF-Erzeugung im Studio mehr anbieten.

#### Scenario: Studio pflegt nur statische PDF-Inhalte

- **WHEN** ein berechtigter Benutzer den Tab `Ausgabe` im Waste-Management öffnet
- **THEN** kann er dort nur statische PDF-Inhalte wie Branding-Grafik oder Kontaktblock pflegen
- **AND** das Studio zeigt keinen Button zur PDF-Erzeugung
- **AND** das Studio zeigt keine Liste persistierter Waste-PDF-Artefakte

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

#### Scenario: CSV-Import meldet echten Laufzeitfortschritt für laufende Spezialimporte
- **WHEN** ein Benutzer den Waste-Spezialimport für Tourzuordnungen nach Fraktionen startet
- **THEN** veröffentlicht das System während des laufenden Commit-Pfads einen echten Fortschritt mit verarbeiteten und insgesamt zu verarbeitenden gültigen Zeilen
- **AND** der Fortschritt enthält fachliche Phasen wie Vorbereitung, Importlauf und Abschluss
- **AND** fehlerhafte Zeilen aus der Vorvalidierung erhöhen nicht die Laufzeit-Gesamtmenge des Commit-Pfads

#### Scenario: Laufender Import zeigt Prozentwert und Zeilenbezug
- **WHEN** ein laufender Waste-Import im Datentools-Bereich angezeigt wird
- **THEN** sieht der Benutzer einen Fortschrittsbalken mit Prozentwert
- **AND** die Anzeige nennt mindestens die aktuelle Phase sowie `verarbeitete Zeilen / Gesamtzeilen`
- **AND** die Darstellung bleibt auf den aktuell laufenden Import fokussiert und überlädt nicht die Historienansicht

#### Scenario: Fortschrittsmeldungen bleiben technisch kontrolliert
- **WHEN** der Waste-Import viele gültige CSV-Zeilen verarbeitet
- **THEN** persistiert das System Fortschrittsmeldungen blockweise statt zwingend für jede einzelne Zeile
- **AND** die gewählte Strategie hält Jobdetail und UI fachlich aussagekräftig, ohne die Event-Persistenz unverhältnismäßig zu vergrößern

### Requirement: Waste-Management bietet einen Ausgabe-Tab für PDF-Stamminhalte

Das System SHALL innerhalb des Waste-Management-Plugins einen zusätzlichen Tab `Ausgabe` bereitstellen.

#### Scenario: Benutzer wechselt in den Ausgabe-Bereich

- **WHEN** ein berechtigter Benutzer im Waste-Management den Tab `Ausgabe` auswählt
- **THEN** rendert das Plugin ein eigenes Tabpanel für PDF-bezogene Stamminhalte
- **AND** das Tabpanel ist als vertikale Folge von Cards organisiert
- **AND** es bietet keine operative Dokumenterzeugung an

### Requirement: Der Ausgabe-Tab pflegt nur statische PDF-Inhalte

Das System SHALL den Tab `Ausgabe` ausschließlich für statische PDF-Inhalte verwenden, die nicht aus den fachlichen Waste-Daten stammen.

#### Scenario: Benutzer pflegt PDF-Stamminhalte

- **WHEN** ein berechtigter Benutzer den Tab `Ausgabe` nutzt
- **THEN** kann er dort Branding-Grafik und Kontaktblock pflegen
- **AND** diese Inhalte werden vom öffentlichen PDF-Export verwendet
- **AND** der Tab enthält keine Auswahl von Abholort oder Jahr für eine Studio-seitige PDF-Erzeugung

### Requirement: Der Ausgabe-Tab dient nur der Konfiguration, nicht der Vorschau oder Erzeugung

Das System SHALL im Tab `Ausgabe` weder eine PDF-Vorschau noch eine PDF-Erzeugung im Studio anbieten.

#### Scenario: Benutzer öffnet den Ausgabe-Tab

- **WHEN** ein berechtigter Benutzer die PDF-Konfiguration im Tab `Ausgabe` aufruft
- **THEN** zeigt der Tab nur die Konfigurationsoberfläche
- **AND** rendert keine eingebettete PDF-Vorschau
- **AND** zeigt keinen Button `PDF erzeugen`
- **AND** listet keine erzeugten PDF-Artefakte

### Requirement: Waste-Management referenziert nur die gemeinsame PDF-Kernlogik

Das System SHALL die produktive Waste-PDF-Kernlogik nur noch als gemeinsame fachliche Grundlage referenzieren, ohne selbst den operativen Exportpfad zu besitzen.

#### Scenario: Gemeinsame PDF-Kernlogik bleibt produktiv nutzbar

- **WHEN** das System den vorhandenen Waste-Calendar-Beispielgenerator fachlich weiterentwickelt
- **THEN** stammen Dokumentmodell, Datenaufbereitung und Rendering weiterhin aus einem produktiven Package-Pfad
- **AND** `scripts/ops/waste-calendar-example-pdf*.ts` bleibt Referenz oder Quellmaterial, aber nicht der produktive Laufzeitvertrag
- **AND** der operative Exportpfad liegt in der öffentlichen Web-App

### Requirement: Waste-Management zeigt keine persistenten PDF-Artefakte mehr

Das System SHALL weder im Tab `Ausgabe` noch in der Tabelle `Abholorte` persistierte Waste-PDF-Artefakte oder Jahreslinks anzeigen.

#### Scenario: Benutzer arbeitet in der Abholorte-Tabelle

- **WHEN** ein berechtigter Benutzer die Tabelle `Abholorte` betrachtet
- **THEN** enthält diese Tabelle keine Spalte oder Zellinhalte für erzeugte Waste-PDFs
- **AND** der Benutzer wird für PDF-Exporte auf die öffentliche Web-App verwiesen

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

### Requirement: Waste-Fraktionen besitzen eine direkte Erinnerungs-Konfiguration
Das System SHALL Abfallfraktionen direkt um eine Reminder-Konfiguration erweitern, statt dafür eine separate Settings-Entität zu verwenden.

#### Scenario: Benutzer pflegt Erinnerungen an einer Fraktion
- **WHEN** ein berechtigter Benutzer eine Abfallfraktion erstellt oder bearbeitet
- **THEN** kann er die Anzahl möglicher Erinnerungen direkt im Fraktionsdialog festlegen
- **AND** die Konfiguration wird zusammen mit den übrigen Fraktionsstammdaten persistiert

### Requirement: Waste-Fraktionen persistieren Reminder-Konfigurationen im kanalbezogenen JSON-Schema
Das System SHALL die Reminder-Konfiguration einer Abfallfraktion im fachlich führenden JSON-Schema mit `channels` und optionalen kanalbezogenen `slots` persistieren.

#### Scenario: Fraktion speichert einen kanalbezogenen Reminder-Block
- **WHEN** eine Fraktion mindestens einen aktivierten Reminder-Channel besitzt
- **THEN** persistiert das System für jeden aktivierten Channel einen eigenen Konfigurationsblock
- **AND** jeder Block enthält eine `slots`-Liste mit stabilen `id`, `max_lead_days` und `default_lead_days`
- **AND** deaktivierte Channels werden nicht als eigener Slot-Block persistiert

### Requirement: Die Reminder-Konfiguration erscheint nur im Fraktionsdialog als vierter Block
Das System SHALL die Reminder-Konfiguration im Create-/Edit-Dialog der Abfallfraktion als eigenen vierten Block darstellen und die Fraktionen-Tabelle dafür nicht erweitern.

#### Scenario: Listenansicht bleibt unverändert
- **WHEN** ein Benutzer die Fraktionen-Tabelle in der Listenansicht öffnet
- **THEN** zeigt die Tabelle keine zusätzliche Reminder-Spalte, kein Reminder-Badge und keine gesonderte Tabellenaktion für diese Konfiguration

#### Scenario: Create- oder Edit-Ansicht zeigt den Reminder-Block
- **WHEN** ein Benutzer die Fraktions-Erstellung oder -Bearbeitung öffnet
- **THEN** erscheint die Reminder-Konfiguration als eigener vierter Block innerhalb der Formularansicht
- **AND** der Block bündelt Auswahl der Erinnerungsanzahl, Lead-Day-Dropdowns und globale Kanal-Switches

### Requirement: Waste-Fraktionen steuern Anzahl und maximale Vorlaufzeiten von Erinnerungen
Das System SHALL pro Abfallfraktion die Ausprägungen `none`, `once` oder `twice` sowie pro aktivem Channel je Slot eine maximale Vorlaufzeit von 1 bis 14 Tagen und einen Default-Wert speichern.

#### Scenario: Fraktion erlaubt zwei Erinnerungen
- **WHEN** eine Fraktion auf `twice` konfiguriert wird
- **THEN** speichert das System pro aktivem Channel zwei Slots mit `max_lead_days` im Bereich von 1 bis 14 Tagen
- **AND** jeder Slot enthält zusätzlich einen `default_lead_days`-Wert im Bereich von 1 bis 14 Tagen
- **AND** es erzwingt keine Ordnungsregel zwischen beiden Werten

#### Scenario: Fraktion erlaubt keine Erinnerungen
- **WHEN** eine Fraktion auf `none` konfiguriert wird
- **THEN** behandelt das System alle kanalbezogenen Slot-Listen als nicht gesetzt
- **AND** spätere Nutzeroberflächen dürfen für diese Fraktion keine Erinnerungsauswahl anbieten

### Requirement: Waste-Fraktionen schalten Erinnerungskanäle global frei
Das System SHALL pro Abfallfraktion globale Kanalfreigaben für Push, E-Mail und Kalender speichern.

#### Scenario: Fraktion aktiviert ausgewählte Kanäle
- **WHEN** ein berechtigter Benutzer für eine Fraktion Push und Kalender aktiviert, E-Mail aber deaktiviert lässt
- **THEN** persistiert das System genau diese globale Kanalfreigabe an der Fraktion
- **AND** die Freigabe gilt unabhängig davon, ob später eine oder zwei Erinnerungen genutzt werden
- **AND** nur für Push und Kalender werden kanalbezogene Slot-Blöcke persistiert

### Requirement: Slot-IDs bleiben über Migrationen und Folgeänderungen stabil
Das System SHALL Reminder-Slots mit persistent stabilen IDs führen, damit gespeicherte nutzerbezogene Geräteeinstellungen gültig bleiben.

#### Scenario: Bestandsdaten werden in das neue Modell überführt
- **WHEN** bestehende Fraktionen aus dem flachen Reminder-Modell in das neue JSON-Schema migriert werden
- **THEN** erzeugt das System deterministische Slot-IDs aus Fraktions-ID, Channel und Slotposition
- **AND** diese IDs bleiben bei späteren Reads und Writes unverändert erhalten
- **AND** spätere Clients dürfen sich auf diese IDs als stabilen Persistenzanker verlassen

### Requirement: Host-Fassade normalisiert inkonsistente Reminder-Requests kanonisch
Das System SHALL nicht relevante Reminder-Felder serverseitig auf einen kanonischen Zustand normalisieren.

#### Scenario: Request enthält überzählige Werte für deaktivierte Erinnerungen
- **WHEN** ein Request für eine Fraktion `none` oder `once` setzt, aber zusätzliche kanalbezogene Slots oder Lead-Day-Werte mitschickt
- **THEN** verwirft die Host-Fassade nicht relevante Slot-Einträge
- **AND** deaktiviert bei `none` zusätzlich alle Kanalfreigaben
- **AND** persistiert nur den kanonischen, fachlich gültigen Zustand

### Requirement: Die neue Reminder-Konfiguration wird aus Bestandsfeldern backfilled
Das System SHALL bestehende Reminder-Daten aus dem bisherigen flachen Spaltenmodell in die neue JSONB-Source-of-Truth überführen.

#### Scenario: Flache Reminder-Felder werden in `reminder_config` migriert
- **WHEN** das Waste-Schema mit dem neuen Reminder-Modell initialisiert oder aktualisiert wird
- **THEN** backfilled das System vorhandene Werte aus `reminder_count`, `first_reminder_max_lead_days`, `second_reminder_max_lead_days` und `reminder_channel_*`
- **AND** die kanalbezogenen Slot-Listen werden für aktivierte Channels aus dem bisherigen Ein- oder Zwei-Slot-Modell aufgebaut
- **AND** `default_lead_days` wird für migrierte Bestandswerte deterministisch gesetzt

### Requirement: Studio verwaltet nur statische PDF-Stamminhalte

Das System SHALL den Tab `Ausgabe` im Studio ausschließlich für PDF-bezogene Stamminhalte verwenden, die nicht aus den fachlichen Waste-Daten stammen.

#### Scenario: Ausgabe-Tab erzeugt keine PDFs mehr

- **WHEN** ein berechtigter Benutzer den Tab `Ausgabe` im Waste-Management öffnet
- **THEN** kann er dort nur statische Inhalte wie Branding oder Kontakttext pflegen
- **AND** es wird kein Button zur PDF-Erzeugung angeboten
- **AND** es werden keine erzeugten PDF-Artefakte oder Jahreslinks gelistet

### Requirement: Waste-Fraktionen können ein optionales PDF-Kürzel tragen

Das System SHALL an Waste-Fraktionen ein optional pflegbares Kürzel für die PDF-Legende unterstützen.

#### Scenario: Fraktionskürzel wird migrationssicher eingeführt

- **WHEN** das System das neue Fraktionskürzel einführt
- **THEN** erfolgt die Persistenz über eine explizite DB-Migration in der bestehenden `waste_*`-Tabellenfamilie
- **AND** Schema-Snapshot und Schema-Dokumentation werden im selben Change aktualisiert

#### Scenario: Fehlendes Kürzel blockiert die Pflege nicht

- **WHEN** für eine Fraktion kein Kürzel gepflegt ist
- **THEN** bleibt die Fraktion gültig und verwendbar
- **AND** nachgelagerte PDF-Logik darf auf einen Fallback aus der Bezeichnung zurückgreifen

### Requirement: Waste-Management erlaubt das Duplizieren von Touren
Das System SHALL im Tourenbereich eine Duplizierungsaktion bereitstellen, die den bestehenden Create-Flow mit vorbelegten Tourdaten öffnet.

#### Scenario: Benutzer öffnet den Duplizieren-Flow
- **GIVEN** eine vorhandene Tour in der Tourentabelle
- **WHEN** ein berechtigter Benutzer die Aktion `Duplizieren` ausführt
- **THEN** öffnet das System den bestehenden Tour-Create-View
- **AND** das Formular ist mit allen Stammdaten einschließlich Turnus, individuellen Terminen und Gültigkeitsdaten der Quell-Tour vorbelegt
- **AND** der Name erhält initial das Suffix ` (Kopie)`

### Requirement: Waste-Management kopiert abhängige Tour-Beziehungen erst nach dem Speichern
Das System SHALL Abholort-Zuordnungen und tourbezogene Datumsverschiebungen erst nach erfolgreichem Speichern der neuen Tour serverseitig übernehmen.

#### Scenario: UI erklärt die verzögerte Übernahme
- **WHEN** ein Benutzer den Create-View aus einem Duplizieren-Flow öffnet
- **THEN** sieht er vor den Save-Actions einen Hinweis zur erst nachgelagerten Übernahme der Zuordnungen

#### Scenario: Server dupliziert Beziehungen vollständig
- **WHEN** die neue Tour erfolgreich gespeichert wird
- **THEN** kopiert das System die Abholort-Zuordnungen, datumsspezifische Abholort-Zuordnungen und tourbezogene Datumsverschiebungen der Quell-Tour auf die neue Tour
- **AND** für alle kopierten Abholort-Zuordnungen gilt ausschließlich der Zeitraum der neuen Tour
- **AND** die Original-Tour bleibt unverändert
- **AND** Teilerfolge sind nicht zulässig

### Requirement: Waste-Management speichert ein Bundesland für Feiertagsregeln
Das System SHALL in den Waste-Einstellungen ein gültiges Bundeslandkürzel für die Feiertagsintegration speichern.

#### Scenario: Benutzer speichert Bundesland
- **WHEN** ein berechtigter Benutzer ein gültiges Bundeslandkürzel speichert
- **THEN** persistiert das System das Kürzel für die aktive Instanz

### Requirement: Waste-Management synchronisiert Feiertagsentwürfe synchron über 10 Jahre
Das System SHALL beim Settings-Speichern sowie per manueller Regeneration Feiertage für das aktuelle Jahr bis einschließlich `aktuelles Jahr + 9` laden und als Feiertags-Regelentwürfe persistieren.

#### Scenario: Sync meldet Status zurück
- **WHEN** der Feiertagssync nach dem Settings-Speichern abgeschlossen ist
- **THEN** enthält die Antwort `success`, `partial_success` oder `failed`

#### Scenario: Import legt oder bestätigt Feiertags-Regelentwürfe
- **WHEN** der Sync für ein Bundesland und einen 10-Jahres-Horizont erfolgreich läuft
- **THEN** legt das System pro geladenem Feiertag einen Feiertags-Regelentwurf an oder bestätigt einen bestehenden automatischen Eintrag erneut
- **AND** fehlende Quellbestätigung löscht bestehende automatische Einträge nicht, sondern markiert sie als `not-confirmed`

### Requirement: Manuelle globale Regeln bleiben unangetastet
Das System SHALL manuelle globale Date-Shifts nie durch automatisch importierte Feiertagsentwürfe überschreiben.

#### Scenario: Konflikt mit manueller globaler Regel
- **WHEN** ein importierter Feiertag denselben Wirkzeitraum wie eine manuelle globale Regel berührt
- **THEN** markiert das System den Feiertagsentwurf als Konflikt
- **AND** verändert die manuelle globale Regel nicht

### Requirement: Feiertags-Regelentwürfe sind separat pflegbar
Das System SHALL im Scheduling-Bereich eine eigene Pflegeoberfläche für importierte Feiertags-Regelentwürfe bereitstellen.

#### Scenario: Benutzer konfiguriert Geltungsbereich und Strategie
- **WHEN** ein Benutzer für einen importierten Feiertagsentwurf Geltungsbereich und Strategie vollständig setzt
- **THEN** speichert das System die Werte am Feiertags-Regelentwurf
- **AND** der Entwurf gilt als fachlich konfiguriert

### Requirement: Waste-Management bietet benutzerdefinierte Abstandspresets pro Instanz
Das System SHALL im Settings-Bereich des Waste-Managements instanzbezogene Abstandspresets mit Name, optionaler Beschreibung und positiver Tagesanzahl verwalten.

#### Scenario: Benutzer legt einen benutzerdefinierten Abstand an
- **WHEN** ein berechtigter Benutzer im Settings-Bereich einen Namen und eine positive Tagesanzahl speichert
- **THEN** persistiert das System ein instanzbezogenes Abstandspreset
- **AND** das Preset steht anschließend im Tour-Formular als zusätzliche Option zur Verfügung

### Requirement: Waste-Touren können ein benutzerdefiniertes Abstandspreset referenzieren
Das System SHALL Touren zusätzlich zu den festen Default-Turnussen eine Referenz auf ein benutzerdefiniertes Abstandspreset speichern lassen.

#### Scenario: Tour verwendet benutzerdefinierten Abstand
- **WHEN** eine Tour ein Preset auswählt
- **THEN** speichert das System die Preset-Referenz statt einer freien Tageszahl an der Tour
- **AND** die Terminberechnung verwendet die Tagesanzahl des referenzierten Presets
- **AND** `customDates` bleiben zusätzlich wirksam

### Requirement: Löschen eines verwendeten Presets verlangt einen Fallback
Das System SHALL beim Löschen eines referenzierten Abstandspresets eine Fallback-Zuweisung für betroffene Touren erzwingen.

#### Scenario: Benutzer löscht ein verwendetes Preset
- **GIVEN** mindestens eine Tour referenziert das Preset
- **WHEN** ein berechtigter Benutzer das Preset löschen will
- **THEN** verlangt das System die Auswahl eines Fallback-Presets oder eines festen Default-Turnus
- **AND** stellt alle betroffenen Touren serverseitig atomar auf den Fallback um
- **AND** löscht erst danach das Preset

### Requirement: Waste-Management verwaltet generische Tour-Einsätze

Das System SHALL explizite Einsätze für normale Waste-Touren mit Datum, optionalem Hinweis und mindestens einem Abholort verwalten.

#### Scenario: Redaktion pflegt einen Einsatz mit mehreren Orten

- **WHEN** ein Benutzer mit `waste-management.scheduling.manage` einen Einsatz einer Tour speichert
- **THEN** werden Datum, optionaler Hinweis und alle ausgewählten Abholorte atomar gespeichert
- **AND** die Pflege verwendet die bestehende Tour-/Scheduling-Oberfläche ohne Schadstoffmobil-Sonderpfad

#### Scenario: Mehrere Einsätze teilen Tour und Datum

- **WHEN** mehrere Einsätze derselben Tour dasselbe Datum tragen
- **THEN** bleiben sie als getrennte Einsätze zulässig

### Requirement: Bestehende ortsbezogene Einzeltermine bleiben erhalten

Das System SHALL bestehende ortsbezogene Tourtermine idempotent in das Einsatzmodell überführen.

#### Scenario: Migration eines Einzeltermins

- **WHEN** ein bisheriger Einzeltermin migriert wird
- **THEN** entsteht ein Einsatz mit derselben Tour, demselben Datum, demselben Hinweis und genau einem Abholort
- **AND** eine wiederholte Migration erzeugt keinen zweiten Einsatz

#### Scenario: CSV ohne Einsatz-ID erzeugt einen Einzel-Einsatz

- **WHEN** ein gültiger CSV-Import für ortsbezogene Tourtermine keine `Einsatz-ID` enthält
- **THEN** erzeugt das System pro importiertem Einzeltermin einen Einsatz mit genau einem Abholort
- **AND** es schreibt keinen neuen Termin ausschließlich in das Legacy-Modell

### Requirement: Abholort-Zuordnungen verwenden ausschließlich die Tour-Gültigkeit

Das System SHALL für alle einer Tour zugeordneten Abholorte ausschließlich den an der Tour gepflegten Gültigkeitszeitraum verwenden und SHALL keine abweichenden Start- oder Enddaten an der Zuordnung speichern oder auswerten.

#### Scenario: Wiederkehrende Tour wird für einen Abholort materialisiert

- **WHEN** das System Termine einer Tour für einen zugeordneten Abholort materialisiert
- **THEN** begrenzen ausschließlich `first_date` und `end_date` der Tour die wiederkehrenden Termine
- **AND** die Orts–Tour-Zuordnung besitzt kein eigenes Gültigkeitsfenster

#### Scenario: Bestehende Zuordnungszeiträume werden migriert

- **WHEN** das Runtime-Schema auf das zentrale Tour-Gültigkeitsmodell aktualisiert wird
- **THEN** entfernt das System vorhandene `start_date`- und `end_date`-Spalten der Orts–Tour-Zuordnung idempotent
- **AND** Touren und ihre Abholort-Zuordnungen bleiben bestehen
- **AND** vorhandene Tourzeiträume werden nicht aus den entfernten Zuordnungswerten verändert

### Requirement: Tour-Zuordnungen sind fachlich sortiert

Das System SHALL Abholorte im Dialog zur Tour-Zuordnung tabellarisch mit getrennten Fachwerten darstellen und SHALL die vollständige gefilterte Ergebnismenge interaktiv sortieren können, ohne die Gruppierung ausgewählter und nicht ausgewählter Abholorte aufzuheben.

#### Scenario: Dialog zeigt getrennte Adressspalten

- **WHEN** ein Benutzer den Dialog zur Tour-Zuordnung öffnet
- **THEN** zeigt das System Auswahl, Region, Ort, Straße und Hausnummer in getrennten Tabellenspalten
- **AND** das System zeigt weder den Aktivstatus noch einen zusätzlichen Zuordnungsstatus des Abholorts
- **AND** zusammengesetzte Werte wie `Amt Meyenburg / Brügge / Alle Straßen / Alle Hausnummern` werden den vier passenden Adressspalten zugeordnet
- **AND** auf schmalen Ansichten bleiben dieselben Fachwerte beschriftet und lesbar

#### Scenario: Benutzer sortiert die gefilterten Abholorte nach Ort und Straße

- **WHEN** ein Benutzer die Sortierrichtung auswählt
- **THEN** sortiert das System die vollständige aktuell gefilterte Ergebnismenge hierarchisch nach Ort, Straße und Hausnummer in der gewählten Richtung
- **AND** die Filterung erfolgt vor der Sortierung
- **AND** ausgewählte Abholorte stehen weiterhin vor nicht ausgewählten Abholorten
- **AND** dieselbe Sortierhierarchie gilt innerhalb beider Gruppen
- **AND** fehlende Werte stehen nach vorhandenen Werten
- **AND** Bezeichnung und ID stellen bei gleichen Adresswerten eine stabile Reihenfolge sicher

#### Scenario: Benutzer berücksichtigt die Region bei der Mehrfachsortierung

- **WHEN** ein Benutzer Region als optionales Sortierkriterium aktiviert
- **THEN** sortiert das System hierarchisch nach Region, Ort, Straße und Hausnummer
- **AND** die gewählte Sortierrichtung gilt für alle Adresskriterien
- **AND** deaktiviert der Benutzer das Kriterium wieder, beginnt die Sortierhierarchie erneut mit dem Ort

#### Scenario: Benutzer ändert Auswahl bei aktiver Sortierung

- **WHEN** ein Benutzer einen sichtbaren Abholort aus- oder abwählt
- **THEN** aktualisiert das System die ausgewählte beziehungsweise nicht ausgewählte Gruppe unmittelbar
- **AND** die optionale Regionssortierung und die Sortierrichtung bleiben erhalten
- **AND** Auswahlen außerhalb des aktuellen Filters bleiben unverändert gespeichert

### Requirement: Waste-Management prüft die lückenlose Fraktionszuordnung aktiver Abholorte

Das System SHALL für eine gewählte Abfallfraktion und einen einschließlich begrenzten Prüfzeitraum ermitteln, ob jeder aktive Abholort durch mindestens eine Standort–Tour-Zuordnung zu einer aktiven Tour dieser Fraktion lückenlos abgedeckt ist.

#### Scenario: Mehrere Zuordnungen decken den Prüfzeitraum gemeinsam ab

- **WHEN** sich die zentralen Gültigkeitszeiträume mehrerer einem aktiven Abholort zugeordneter Touren derselben Fraktion überlappen oder unmittelbar aneinander anschließen
- **THEN** bewertet das System den Abholort als vollständig abgedeckt

#### Scenario: Abholort besitzt keine passende Zuordnung

- **WHEN** ein aktiver Abholort keiner Tour der gewählten Fraktion zugeordnet ist
- **THEN** weist das System den Abholort als `Keine Zuordnung` aus

#### Scenario: Abholort ist nur inaktiven Touren zugeordnet

- **WHEN** ein aktiver Abholort für die gewählte Fraktion ausschließlich inaktiven Touren zugeordnet ist
- **THEN** berücksichtigt das System diese Touren nicht als operative Abdeckung
- **AND** weist den Abholort als `Keine Zuordnung` aus

#### Scenario: Passende Zuordnungen lassen zeitliche Lücken

- **WHEN** ein aktiver Abholort passenden Touren zugeordnet ist, deren zentrale Gültigkeitszeiträume den Prüfzeitraum nicht vollständig abdecken
- **THEN** weist das System den Abholort als `Zeitraum unvollständig` aus
- **AND** zeigt die nicht abgedeckten Zeiträume an

#### Scenario: Unbegrenzte Tourgrenze deckt den Prüfzeitraum ab

- **WHEN** Start- oder Enddatum einer passenden Tour leer ist
- **THEN** behandelt das System die jeweilige Grenze für die Prüfung als unbegrenzt

### Requirement: Prüfergebnisse bleiben direkt bearbeitbar

Das System SHALL problematische Abholorte im Abholort-Bereich anzeigen und die bestehenden Aktionen zur Einzel- und Sammelzuweisung verfügbar halten.

#### Scenario: Benutzer behebt gefundene Zuordnungslücken

- **WHEN** die Prüfung fehlende oder unvollständige Zuordnungen findet
- **THEN** kann der Benutzer die betroffenen Abholorte als exakte Auswahl übernehmen und einer Tour zuordnen
- **AND** zuvor ausgewählte, nicht betroffene Abholorte werden nicht in die Sammelzuweisung übernommen
- **AND** kann er einen einzelnen Abholort zur detaillierten Pflege seiner Tour-Zuordnungen öffnen

### Requirement: Ungültige Prüfzeiträume werden zugänglich abgewiesen

Das System SHALL eine Prüfung ohne Abfallfraktion oder mit einem Enddatum vor dem Startdatum verhindern und den Fehler am Prüfbereich zugänglich ausgeben.

#### Scenario: Enddatum liegt vor dem Startdatum

- **WHEN** ein Benutzer die Prüfung mit einem Enddatum vor dem Startdatum startet
- **THEN** führt das System keine Prüfung aus
- **AND** zeigt eine verständliche Fehlermeldung im Prüfbereich an

### Requirement: Waste-Abholorte liefern Zielschlüssel für Nachrichten

Das System MUST aus aktiven Abholorten und ihrer Adresshierarchie stabile Zielschlüssel für Nachrichten ableiten.

#### Scenario: Konkrete Hausnummer wird abgebildet

- **WHEN** ein Abholort auf eine Straße und eine Hausnummer verweist
- **THEN** enthält der Zielschlüssel den zusammengesetzten Straßen- und Hausnummerntext sowie PLZ und Ort

#### Scenario: Abholort besitzt keine Hausnummer

- **WHEN** ein aktiver Abholort auf einen Ort mit PLZ und eine Straße, aber auf keine Hausnummer verweist
- **THEN** enthält der Zielschlüssel die Straße ohne Hausnummer sowie PLZ und Ort
- **AND** adressiert der Schlüssel die gesamte Straße

#### Scenario: Doppelte Schlüssel sind vorhanden

- **WHEN** mehrere Abholortdatensätze dieselbe Straße, PLZ und denselben Ort ergeben
- **THEN** gibt die Nachrichtenzielauswahl diesen externen Schlüssel nur einmal aus

### Requirement: Städte unterstützen feldselektive Updates

Das System MUST bei Stadt-Updates ausschließlich explizit übermittelte Felder verändern.

#### Scenario: Postleitzahl wird ergänzt

- **WHEN** ein Client nur `postalCode` aktualisiert
- **THEN** bleiben der aktuelle Name und die aktuelle Region der Stadt unverändert

#### Scenario: Optionales Feld wird ausgelassen

- **WHEN** ein älterer Client `postalCode` nicht übermittelt
- **THEN** bleibt eine bestehende Postleitzahl unverändert

#### Scenario: Postleitzahl wird ausdrücklich entfernt

- **WHEN** ein Client `postalCode: null` übermittelt
- **THEN** wird die Postleitzahl entfernt

### Requirement: Reine Waste-Icon-Aktionen erklären ihre Funktion per Tooltip

Das System SHALL für jeden interaktiven Waste-Management-Button, dessen sichtbarer Inhalt ausschließlich aus einem Icon besteht, einen lokalisierten Tooltip mit derselben Bedeutung wie die zugängliche Beschriftung anzeigen.

#### Scenario: Benutzer zeigt mit der Maus auf eine Icon-Aktion

- **WHEN** ein Benutzer mit der Maus auf einen reinen Icon-Aktionsbutton zeigt
- **THEN** zeigt das System einen kurzen erklärenden Tooltip

#### Scenario: Benutzer fokussiert eine Icon-Aktion mit der Tastatur

- **WHEN** ein Benutzer einen reinen Icon-Aktionsbutton mit der Tastatur fokussiert
- **THEN** zeigt das System denselben erklärenden Tooltip

#### Scenario: Icon besitzt bereits sichtbaren Erklärungstext

- **WHEN** ein Icon innerhalb eines Buttons bereits von einer sichtbaren Aktionsbeschriftung begleitet wird oder rein dekorativ ist
- **THEN** fügt das System keinen redundanten Tooltip hinzu

### Requirement: Waste-PDF-Branding verwendet den gemeinsamen Medienpicker

Das System SHALL im Waste-Ausgabe-Tab für die optionale PDF-Branding-Grafik den gemeinsamen Studio-Medienpicker verwenden und ausschließlich eine dauerhafte öffentliche Medien-URL in der Waste-Konfiguration speichern.

#### Scenario: Öffentliches Medium aus der Mediathek auswählen

- **WHEN** ein zur Medienauswahl berechtigter Benutzer `Medium hinzufügen` aktiviert
- **AND** ein öffentliches Bild aus der Mediathek auswählt
- **THEN** zeigt der Ausgabe-Tab eine Vorschau des ausgewählten Bildes
- **AND** speichert beim Speichern der PDF-Inhalte dessen dauerhafte öffentliche URL als Branding-Grafik

#### Scenario: Neues öffentliches Medium hochladen

- **WHEN** ein zusätzlich zu `media.read` und `media.reference.manage` mit `media.create` berechtigter Benutzer ein Bild hochlädt
- **THEN** legt das System das Medium als öffentliches Bild an
- **AND** übernimmt dessen dauerhafte öffentliche URL als Branding-Grafik

#### Scenario: Upload-Berechtigung fehlt

- **WHEN** ein Benutzer Medien auswählen, aber keine Medien erstellen darf
- **THEN** bleibt die Auswahl aus der öffentlichen Mediathek verfügbar
- **AND** bietet der Medienpicker keinen erreichbaren Upload-Pfad an

#### Scenario: Manuelle URL verwenden

- **WHEN** ein berechtigter Benutzer im Medienpicker eine manuelle URL eingibt
- **THEN** akzeptiert das System nur eine persistierbare HTTPS-URL ohne Zugangsdaten oder flüchtige Signaturparameter
- **AND** speichert diese URL ohne Medienreferenz als Branding-Grafik

#### Scenario: Branding-Grafik entfernen

- **WHEN** ein berechtigter Benutzer die aktuell dargestellte Branding-Grafik entfernt und die PDF-Inhalte speichert
- **THEN** entfernt das System die Branding-URL aus der Waste-Konfiguration
- **AND** das öffentliche Waste-PDF wird weiterhin ohne Branding-Grafik erzeugt

### Requirement: Waste-Management ergänzt fehlende Stadt-Postleitzahlen kontrolliert

Das System MUST berechtigten Administratoren erlauben, fehlende Postleitzahlen von Waste-Städten als kontrollierte Systemfunktion automatisch zu ergänzen.

#### Scenario: Administrator startet die Anreicherung

- **WHEN** ein Benutzer mit `waste-management.master-data.manage` die Aktion unter „Datentools → Erweiterte Systemfunktionen“ startet
- **THEN** führt das System die Anreicherung als mandantenisolierten Hintergrundjob aus
- **AND** zeigt das Studio den laufenden Prozess und sein aggregiertes Ergebnis nachvollziehbar an

#### Scenario: Stadt besitzt einen plausiblen Treffer

- **WHEN** eine Stadt noch keine Postleitzahl besitzt und die hostgeführte Ermittlung eine konsistente deutsche fünfstellige Postleitzahl mit passendem Ortsbezug liefert
- **THEN** ergänzt das System ausschließlich die Postleitzahl dieser Stadt
- **AND** bleiben Name, Region und alle übrigen Fachdaten unverändert

#### Scenario: Treffer bleibt unsicher

- **WHEN** die Ermittlung keinen Treffer, eine ungültige Postleitzahl, einen abweichenden Orts- oder Länderkontext oder widersprüchliche Postleitzahlen liefert
- **THEN** verändert das System die Stadt nicht
- **AND** zählt das Job-Ergebnis den offenen oder mehrdeutigen Fall nachvollziehbar

#### Scenario: Vorhandene Postleitzahl wird geschützt

- **WHEN** eine Stadt bereits vor dem Lauf oder durch eine parallele Pflege eine Postleitzahl besitzt
- **THEN** überschreibt der Anreicherungsjob diesen Wert nicht
- **AND** ein wiederholter Lauf bleibt idempotent

#### Scenario: Geocoding ist nicht verfügbar

- **WHEN** die tenantbezogene Geocoding-Konfiguration fehlt, deaktiviert ist oder der Provider kontrolliert fehlschlägt
- **THEN** erfindet oder persistiert das System keine Postleitzahl
- **AND** der Job endet mit einem nachvollziehbaren Fehler- oder Teilergebnis ohne Secrets oder vollständige Adressanfragen offenzulegen

### Requirement: Waste-PLZ-Anreicherung respektiert Providergrenzen

Das System MUST die automatische Waste-PLZ-Anreicherung innerhalb der konfigurierten Geocoding-Grenzen ausführen.

#### Scenario: Viele Städte benötigen eine Ermittlung

- **WHEN** der Job mehrere Städte über den externen Provider prüft
- **THEN** verarbeitet er die Anfragen mit begrenzter Parallelität und entsprechend dem konfigurierten Minutenlimit
- **AND** meldet er den Fortschritt über den zentralen Jobvertrag statt über eine Browser-Schleife

#### Scenario: Das Anfragebudget ist ausgeschöpft

- **WHEN** die Anreicherung das für den Provider konfigurierte Anfragebudget erreicht
- **THEN** beendet sie weitere Provideranfragen kontrolliert und behält bereits bestätigte Aktualisierungen
- **AND** weist das Ergebnis den Verbrauch und die noch nicht verarbeiteten Städte transparent aus

### Requirement: Waste-Management ändert Gültigkeitszeiträume ausgewählter Touren atomar

Das System SHALL berechtigten Benutzern erlauben, den tourweiten Gültigkeitsbeginn und das tourweite Gültigkeitsende mehrerer ausgewählter turnusbasierter Waste-Touren in einer atomaren Bulk-Aktion zu ändern.

#### Scenario: Benutzer setzt eine Datumsgrenze für mehrere Touren

- **GIVEN** mehrere ausgewählte Touren verwenden einen festen Turnus oder ein benutzerdefiniertes Abstandspreset
- **WHEN** ein Benutzer mit `waste-management.tours.manage` für `Gültig bis` ein Datum setzt und `Gültig ab` unverändert lässt
- **THEN** speichert das System das neue Gültigkeitsende für alle ausgewählten Touren atomar
- **AND** jeder vorhandene Gültigkeitsbeginn bleibt unverändert
- **AND** Einzeltermine, Datumsverschiebungen, Abholort-Zuordnungen und alle übrigen Tourfelder bleiben unverändert

#### Scenario: Benutzer entfernt eine Datumsgrenze explizit

- **GIVEN** die ausgewählten turnusbasierten Touren besitzen ein Gültigkeitsende
- **WHEN** der Benutzer für `Gültig bis` ausdrücklich `entfernen` auswählt
- **THEN** entfernt das System das Gültigkeitsende für alle ausgewählten Touren
- **AND** ein leeres Eingabefeld ohne die Operation `entfernen` löscht keinen vorhandenen Wert

#### Scenario: Gültigkeitsbeginn bleibt als Turnus-Startanker erhalten

- **GIVEN** die ausgewählten Touren berechnen wiederkehrende Termine ab ihrem Gültigkeitsbeginn
- **WHEN** der Benutzer den Gültigkeitszeitraum gesammelt bearbeitet
- **THEN** bietet die Oberfläche für `Gültig ab` keine Operation `entfernen` an
- **AND** der Server lehnt einen dennoch gesendeten Request zum Entfernen des Gültigkeitsbeginns vollständig ab
- **AND** keine ausgewählte Tour verliert ihren Startanker

#### Scenario: Ungültiger resultierender Zeitraum verhindert alle Änderungen

- **GIVEN** die gewählten Patch-Operationen würden bei mindestens einer ausgewählten Tour zu einem Gültigkeitsende vor dem Gültigkeitsbeginn führen
- **WHEN** der Benutzer die Bulk-Aktion bestätigt
- **THEN** lehnt das System den gesamten Request mit einem Validierungsfehler ab
- **AND** keine ausgewählte Tour wird geändert

#### Scenario: Nicht anwendbare Tour verhindert stilles Überspringen

- **GIVEN** die Auswahl enthält eine individuelle oder bedarfsabhängige Tour ohne turnusbasiertes Gültigkeitsfenster
- **WHEN** die Bulk-Aktion vorbereitet oder an den Server gesendet wird
- **THEN** weist die Oberfläche die nicht anwendbare Tour verständlich aus
- **AND** der Server lehnt einen dennoch gesendeten gemischten Request vollständig ab
- **AND** keine Tour wird stillschweigend übersprungen oder geändert

#### Scenario: Bulk-Änderung wird nachvollziehbar auditiert

- **WHEN** der Server eine Bulk-Änderung erfolgreich ausführt oder mit einem fachlichen beziehungsweise technischen Fehler beendet
- **THEN** erzeugt das System ein Audit-Ereignis mit Ergebnis, Batch-Ressource, betroffener Anzahl, Akteur und Instanzkontext
- **AND** das Audit-Ereignis enthält keine vollständigen Tour-Payloads

### Requirement: Waste-Touren können nach relativem Gültigkeitsjahr gefiltert werden

Das System SHALL in der Tourenübersicht einen reload-stabilen Filter für alle Touren, das letzte, das aktuelle oder das nächste Kalenderjahr bereitstellen und initial alle Touren anzeigen.

#### Scenario: Tourenübersicht startet ohne Jahreseinschränkung

- **WHEN** ein Benutzer die Tourenübersicht ohne gesetzten Jahresfilter öffnet
- **THEN** zeigt das System unabhängig vom Gültigkeitsjahr alle Touren an, die den übrigen Filtern entsprechen
- **AND** die Auswahl `Alle Touren` ist aktiv

#### Scenario: Gültigkeitszeitraum überschneidet das ausgewählte Jahr

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** der Gültigkeitszeitraum einer Tour das ausgewählte Jahr mindestens an einem Kalendertag überschneidet
- **THEN** zeigt das System die Tour an
- **AND** ein fehlender Gültigkeitsbeginn oder ein fehlendes Gültigkeitsende wird als offene Grenze behandelt
- **AND** der 1. Januar und der 31. Dezember gehören zum ausgewählten Zeitraum

#### Scenario: Expliziter Termin liegt im ausgewählten Jahr

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** mindestens ein expliziter Termin einer Tour im ausgewählten Kalenderjahr liegt
- **THEN** zeigt das System die Tour unabhängig von einer zusätzlichen Gültigkeitsüberschneidung an

#### Scenario: Tour hat weder passende Gültigkeit noch passenden Termin

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** der Gültigkeitszeitraum einer Tour das ausgewählte Jahr nicht überschneidet
- **AND** kein expliziter Termin der Tour im ausgewählten Jahr liegt
- **THEN** blendet das System die Tour aus

#### Scenario: Jahresfilter bleibt mit bestehenden Filtern kombinierbar

- **WHEN** ein Benutzer den Jahresfilter gemeinsam mit Name, Status, Abfallart oder freien Datumsgrenzen setzt
- **THEN** wendet das System alle gesetzten Kriterien gemeinsam an
- **AND** speichert den relativen Jahresfilter als typisierten Search-Parameter
- **AND** setzt die Listenseite bei einer Änderung des Jahresfilters auf Seite 1 zurück
- **AND** normalisiert einen ungültigen Jahresfilterwert auf `Alle Touren`

### Requirement: Waste-Fraktionen werden vor der Pagination global sortiert

Das System MUST die Fraktionenliste zuerst nach dem aktuellen Statusfilter eingrenzen, danach den vollständigen gefilterten Bestand deterministisch sortieren und erst anschließend paginieren. Die Liste MUST standardmäßig nach Name aufsteigend sortieren, fehlende optionale Werte unabhängig von der Richtung zuletzt einordnen und Gleichstände mit `ID asc` stabilisieren.

#### Scenario: Benutzer sortiert Fraktionen über mehrere Seiten

- **GIVEN** der aktuelle Fraktionenfilter ergibt mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer Sortierfeld oder Sortierrichtung ändert
- **THEN** sortiert die Fachlogik den vollständigen gefilterten Fraktionenbestand
- **AND** schneidet sie erst danach die erste Ergebnisseite zu
- **AND** verändert die gemeinsame Tabellenkomponente die Reihenfolge dieser Seite nicht nochmals lokal

#### Scenario: Optionale Fraktionswerte bleiben am Ende

- **GIVEN** mindestens eine Fraktion besitzt keinen Wert im gewählten optionalen Sortierfeld
- **WHEN** ein Benutzer aufsteigend oder absteigend sortiert
- **THEN** steht die Fraktion ohne Wert in beiden Richtungen nach Fraktionen mit vorhandenem Wert
- **AND** verwendet die Fachlogik kein anderes Feld als Ersatz

### Requirement: DOI-Versandnachrichten bewahren ihren deterministischen Kompositionsvertrag

Das System SHALL DOI-Versandnachrichten aus der Waste-Konfiguration, dem normalisierten Versandauftrag und der zentralen Mail-Transport-Konfiguration deterministisch zusammensetzen, ohne den Token-, Outbox- oder Zustellvertrag in der Kompositionsschicht zu verändern.

#### Scenario: DOI-Text verwendet die bestehende Abschnittsreihenfolge

- **WHEN** eine DOI-Versandnachricht aus vollständigen Textbausteinen und Templatewerten erzeugt wird
- **THEN** enthält ihr Nur-Text-Inhalt Preheader, Intro, Ort, Bestätigungszeile, Fallback, Ablaufhinweis, Service, Verantwortlichen, Datenschutz und Impressum in der bestehenden Reihenfolge
- **AND** die enthaltenen Abschnitte bleiben durch genau eine Leerzeile getrennt
- **AND** unbekannte Template-Platzhalter werden weiterhin durch den leeren String ersetzt

#### Scenario: Optionale oder leere DOI-Abschnitte behalten ihre Legacy-Semantik

- **WHEN** optionale DOI-Texte fehlen, leer sind oder nur Whitespace enthalten
- **THEN** werden dieselben Abschnitte wie bisher ausgelassen
- **AND** ein vorhandener Payload-Wert besitzt weiterhin Nullish-Priorität vor dem entsprechenden Konfigurationswert
- **AND** ein leerer oder nur aus Whitespace bestehender Payload-Wert wird nicht stillschweigend durch den Konfigurationswert ersetzt

#### Scenario: DOI-Envelope bewahrt die bestehende Adresspriorität

- **WHEN** Payload, Waste-Konfiguration und Transport unterschiedliche Absender- oder Antwortadressen liefern
- **THEN** bleiben Payload-`replyTo`, konfiguriertes `replyTo` und Transport-`replyTo` in dieser Prioritätsreihenfolge
- **AND** konfigurierte Absenderwerte bleiben vor Transport-Fallbacks priorisiert
- **AND** `to`, `cc`, `bcc` und vorhandene Anzeigenamen aus dem Payload bleiben unverändert erhalten

#### Scenario: Nicht-DOI-Template bleibt im Reminder-Pfad

- **WHEN** der Versandauftrag keinen DOI-Template-Key besitzt
- **THEN** verwendet das System weiterhin die bestehende Reminder-Komposition
- **AND** das DOI-Refactoring verändert weder Reminder-Text noch Reminder-Envelope

### Requirement: Öffentliche Reminder-Konfiguration wird kanonisch und fail-closed normalisiert

Das System SHALL die öffentliche E-Mail-Reminder-Konfiguration ausschließlich dann bereitstellen, wenn alle bestehenden Pflichtfelder und explizit gesetzten optionalen Felder ihren jeweiligen Typ-, URL-, Pfad-, Adress- und Grenzwertvertrag erfüllen.

#### Scenario: Gültige Konfiguration wird kanonisch ausgegeben

- **WHEN** eine vollständige oder zulässig minimale Reminder-Konfiguration gelesen oder geschrieben wird
- **THEN** normalisiert das System Whitespace, URLs und optionale Felder nach dem bestehenden Vertrag
- **AND** bleibt die öffentliche Ausgabe semantik- und serialisierungsgleich

#### Scenario: Ungültige Konfiguration bleibt fail-closed

- **WHEN** ein Pflichtfeld fehlt oder ein gesetztes Pflicht- oder Optionalfeld den bestehenden Vertrag verletzt
- **THEN** stellt das System keine lesbare Reminder-Konfiguration bereit
- **AND** führt keine neuen Defaults oder Fallbackwerte ein

#### Scenario: Unbekannte Felder und Secrets bleiben außerhalb des normalisierten Objekts

- **WHEN** die Eingabe unbekannte Felder oder Secret-Werte enthält
- **THEN** übernimmt das System sie nicht in das normalisierte Reminder-Konfigurationsobjekt
- **AND** bleibt das Signing-Secret ausschließlich über die bestehende, an eine gültige Konfiguration gebundene Secret-Grenze lesbar

### Requirement: Waste-Tourenliste verwendet die gemeinsamen Tabelleninteraktionen

Das Waste-Management MUST in der Tourenliste die gemeinsamen Studio-Muster für Icon-Aktionen, Status-Badges, anklickbare Informationen und einheitlich oben ausgerichtete Body-Zellen verwenden. Die Migration MUST bestehende Fachlogik, Berechtigungen, Navigation und Mutationen unverändert erhalten.

#### Scenario: Benutzer betrachtet anklickbare Tourinformationen

- **WENN** ein Benutzer die Tourenliste öffnet
- **DANN** erscheinen Tourname, verknüpfte Fraktionen, Verschiebungen und Abholortanzahl im gemeinsamen Muster für anklickbare Informationen
- **UND** werden Fraktionen nicht als Status-Badges dargestellt
- **UND** öffnet der Tourname das bestehende Bearbeitungsziel
- **UND** öffnen Verschiebungen weiterhin ihre Details beziehungsweise das bestehende Erstellungsziel

#### Scenario: Tour besitzt keine Abholortzuordnung

- **GIVEN** eine Tour besitzt `0` zugeordnete Abholorte
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Erstellungsflow für Zuordnungen
- **UND** ist die Zahl im selben Informationsmuster wie eine positive Anzahl dargestellt

#### Scenario: Tour besitzt bestehende Abholortzuordnungen

- **GIVEN** eine Tour besitzt mindestens eine Abholortzuordnung
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Bearbeitungsflow für Zuordnungen
- **UND** ändert die visuelle Vereinheitlichung keine Zuordnungsdaten

#### Scenario: Benutzer ändert den Tourstatus

- **WENN** ein berechtigter Benutzer das Status-Badge einer Tour aktiviert
- **DANN** öffnet sich ein zugänglicher Dialog mit aktuellem und beabsichtigtem Status
- **UND** wird die bestehende Statusmutation erst durch die vorgesehene Bestätigung ausgelöst
- **UND** sind laufende und deaktivierte Zustände erkennbar
- **UND** bleibt das Badge mit dem Statuswert beschriftet

#### Scenario: Benutzer verwendet eine Tour-Zeilenaktion

- **WENN** ein Benutzer Kalender, Duplizieren oder Löschen in der Aktionsspalte verwendet
- **DANN** erscheint die jeweilige Aktion als gemeinsamer Icon-Aktionsbutton mit zugänglichem Tooltip
- **UND** wird keine redundante Bearbeiten-Aktion angeboten, wenn der Tourname bereits dasselbe Ziel öffnet
- **UND** bleiben Berechtigungen, Bestätigung und Zielverhalten der Aktion unverändert

#### Scenario: Tourenzeile enthält ein- und mehrzeilige Inhalte

- **WENN** die Tourenzeile gerendert wird
- **DANN** sind alle Body-Zellen einschließlich Auswahl, Werte, Status und Aktionsgruppe einheitlich oben ausgerichtet
- **UND** verwenden die Zellen dasselbe vertikale Padding
- **UND** bleiben Controls innerhalb ihrer eigenen Trefferfläche zentriert
