## Context

Im `Newcms` existiert ein fachlicher Abfallkalender-MVP mit React-Oberflaechen, einer API-Schicht gegen Supabase-Functions und einem relationalen `waste_*`-Schema. Das Studio besitzt dagegen bereits klare Zielgrenzen:

- Fachoberflaechen leben in Workspace-Plugins ueber `@sva/plugin-sdk`.
- Wiederverwendbare UI kommt aus `@sva/studio-ui-react`.
- Routing, Guards und Search-Param-Validierung bleiben hostgefuehrt.
- Datenzugriff auf externe oder fachspezifische Systeme wird ueber schmale Host-Fassaden gekapselt.
- Instanzisolation und Auditierung sind verbindliche Querschnittsanforderungen.

Der Waste-Management-Change muss diese Welten zusammenbringen, ohne `Newcms` als Architektur in das Studio zu kopieren.

## Goals

- Vollstaendige Admin-Capability fuer Waste-Management im Studio schaffen
- Freies Plugin `waste-management` mit eigener Fachnavigation unter `/plugins/waste-management`
- Hostgefuehrte Studio-API fuer Waste-CRUD, Zuordnungen, CSV-Import, Seed und Reset
- Genau eine Waste-Fachdatenbank pro Studio-Instanz mit klarer technischer Konfiguration im Studio-Postgres
- Fokus auf den Betrieb als fuehrendes Waste-System; sekundaere Fuehrung bleibt als spaetere Erweiterungsrichtung architektonisch offen
- Feingranulares Modul-IAM und revisionsfaehige Auditspur fuer alle Mutationen
- Fachlich belastbares Adress-, Feiertags- und Abweichungsmodell fuer spaetere App-/Push-Ausspielung vorbereiten
- `Newcms` nur als fachliche und UX-Referenz nutzen

## Non-Goals

- Keine Buergerkanal- oder Mobile-Read-API
- Keine Export-/Feed-Schnittstellen
- Keine Uebernahme der `Newcms`-Edge-Functions als produktive Backend-Strategie
- Keine Host-owned `adminResource`-Materialisierung als Hauptoberflaeche

## Decisions

### 1. Plugin- und Routing-Modell

Das Modul wird als freies Fachplugin `waste-management` modelliert. Die Hauptoberflaeche wird unter `/plugins/waste-management` materialisiert und besitzt typisierte Search-Params fuer:

- aktiven Haupttab
- Such- und Filterzustaende
- Paging/Sortierung fuer Listen
- fokussierte Detail- oder Bearbeitungskontexte
- adressbezogene Auswahl- oder Zuordnungskontexte, wenn sie fuer Deep-Links oder Wiedereinstieg relevant sind

Warum:
- Die Oberflaeche ist kein standardisiertes Content-CRUD, sondern ein komplexer Workflow aus Tabellen, Hierarchien, Bulk-Operationen und Spezialtools.
- Das bestehende host-owned `adminResource`-Muster fuer Content waere hier kuenstlich und wuerde die Fachnavigation eher verbergen als vereinheitlichen.

### 2. Server-Fassade und Datenzugriff

Das Plugin importiert keinen Supabase-Client und spricht ausschliesslich die Studio-Fassade unter `/api/v1/waste-management/*` an. Die Fassade kapselt:

- Autorisierung und Instanzkontext
- Validierung und Fehlerabbildung
- Mapping zwischen HTTP-Vertrag und Datenmodell
- Audit-Ausloesung
- serverseitige Aufloesung der fuer die aktive Instanz hinterlegten Waste-Datenquelle
- Datenzugriff auf das `waste_*`-Schema der aufgeloesten Waste-Fachdatenbank
- Vorbereitung spaeterer Upstream-Importe oder Synchronisationslaeufe aus fuehrenden Fremdsystemen

Warum:
- Das folgt dem bestehenden Studio-Muster fuer hostgefuehrte Persistenzgrenzen.
- Browserseitiger Direktsupabasezugriff wuerde Instanzisolation, Logging und Sicherheitskontrollen unterlaufen.
- Die `Newcms`-Edge-Functions wuerden eine zweite Runtime-Grenze mit eigener Fehler- und Auth-Logik einfuehren.
- Die Auswahl der richtigen Waste-Datenbank pro Instanz darf nicht im Plugin liegen, sondern muss serverseitig aus dem Instanzkontext und der hinterlegten Modulkonfiguration erfolgen.

### 3. Datenmodell und Migration

Die bestehende `waste_*`-Tabellenfamilie ist die Migrationsbasis, aber kein unveraenderlicher Vertrag. Das Zielbild trennt zentrale Studio-Governance von Waste-Fachdaten:

- das zentrale Studio-Postgres bleibt System of Record fuer Instanzen, Rollen, Rechte, Audits und technische Modulkonfiguration
- jede Studio-Instanz erhaelt genau eine eigene Waste-Fachdatenbank beziehungsweise genau ein eigenes Supabase-Projekt fuer fachliche Waste-Daten
- die fuer eine Instanz gueltige Waste-Datenquelle wird als serverseitig geschuetzte Modulkonfiguration verwaltet und ueber die Host-Fassade aufgeloest
- Waste-Fachdaten werden nicht als regulaeres Persistenzmodell in der zentralen Studio-Postgres mitgefuehrt
- IAM-, Rollen-, Rechte- und Audit-Primärdaten des Studios werden nicht in der externen Waste-Fachdatenbank gespeichert
- Waste-spezifische Migrations-, Job- und sonstige plugininterne Hilfsdaten duerfen in der externen Waste-Fachdatenbank gespeichert werden, solange sie keine zentrale Studio-Governance duplizieren
- zusaetzliche Status-, Monitoring- und fortlaufende Historienmetadaten zur Erreichbarkeit, Pruefung und Entwicklung der externen Waste-Datenquelle duerfen zentral im Studio-Postgres gehalten werden

Die Waste-Fachdatenbank selbst ist die Mandantengrenze. Das Zielbild fuehrt Waste-Daten daher ohne zusaetzlichen fachlichen `instance_id`-Mandantenschnitt in den Waste-Tabellen:

- bestehende globale Annahmen aus `Newcms` werden bereinigt
- inkompatible Korrekturen sind erlaubt, sofern ein expliziter Migrationspfad dokumentiert wird
- Seed und Reset muessen die aktive Waste-Datenbank der Instanz beachten

Warum:
- Studio-IAM, Routing und Verwaltungslogik arbeiten instanzzentriert.
- Bei genau einer Waste-Datenbank pro Instanz waere ein zusaetzlicher Mandantenschnitt innerhalb derselben Fachdatenbank redundant und fehleranfaellig.
- Die Trennung vermeidet, dass fachliche Massendaten, Betriebsrechte und revisionsrelevante Governance-Daten in derselben Persistenzgrenze vermischt werden.

### 3a. Primaer- und Sekundaersystem-Modell

Der aktuelle Change fokussiert den Betrieb von SVA Studio als fuehrendes Waste-System.

- Waste-Daten werden originär ueber das Studio gepflegt.
- Import, Seed und Reset arbeiten auf dieser fuehrenden Datenhaltung.
- Die Host-Fassade bleibt die einzige Plugin-Schnittstelle.
- Die technische Datenquellenkonfiguration pro Instanz bleibt ueber Studio-Einstellungen pflegbar, ohne dass das Plugin direkte Datenbank-Credentials kennen oder speichern darf.

Sekundaere Fuehrung durch ein externes Fachsystem bleibt fuer spaetere Changes architektonisch zulaessig, ist hier aber ausdruecklich nicht fachlich ausdefiniert:

- keine konkrete Fremdsystem-Schnittstelle
- keine Schreibsperren oder Override-Regeln fuer Sync-Modi
- keine Konfliktlogik zwischen Synchronisation und manueller Pflege

### 3e. Datenquellen-Lebenszyklus und Ausfallverhalten

Die Waste-Datenquelle einer Instanz wird vollstaendig ueber die zentrale Studio-Governance konfiguriert.

- Verbindungsdaten liegen im Studio-Postgres.
- Status-, Monitoring- und fortlaufende Historienmetadaten zur externen Waste-Datenquelle duerfen ebenfalls im Studio-Postgres gehalten werden.
- Die Host-Runtime loest daraus die aktive Waste-Datenquelle serverseitig auf.
- Die Konfiguration bleibt ueber `waste-management.settings.manage` pflegbar.

Die erste verpflichtende Ereignishistorie im Studio-Postgres umfasst mindestens:

- erfolgreiche und fehlgeschlagene Connection-Checks
- Rekonfigurationen der Waste-Datenquelle
- Start, Erfolg und Fehler von Waste-Migrationen
- Start, Erfolg und Fehler von CSV-Importen
- Start, Erfolg und Fehler von Seed-Operationen
- Start, Erfolg und Fehler von Reset-Operationen

Diese erste Historie bleibt bewusst technisch:

- sie dient zunaechst der Betriebs- und Monitoring-Sicht auf die externe Datenquelle
- fachliche Einordnungen oder tiefergehende Business-Historien sind in diesem Change kein Pflichtbestandteil

Fehlgeschlagene Connection-Checks wirken nicht nur historisierend:

- sie muessen zusaetzlich einen sofort sichtbaren aktuellen Status an der zentralen Instanz-/Plugin-Konfiguration hinterlassen
- Administratoren sollen damit ohne Auswertung der Verlaufshistorie erkennen koennen, dass die externe Waste-Datenquelle aktuell gestoert ist
- erfolgreiche Connection-Checks heben diesen sichtbaren Stoerungsstatus sofort wieder auf
- die fortlaufende Historie bleibt davon unberuehrt und bildet den Verlauf weiter ab

Fuer den aktuellen Change gilt ausserdem:

- beim Laden der Settings-Seite darf automatisch ein expliziter Connection-Check ausgefuehrt werden
- auf anderen Waste-Seiten duerfen erfolgreiche oder fehlgeschlagene echte DB-Zugriffe den sichtbaren technischen Status implizit mitbeeinflussen
- fachliche Fehler ohne Connectivity-Bezug duerfen dabei keinen Stoerungsstatus setzen
- periodische Hintergrund-Checks oder eigenstaendige Monitoring-Scheduler sind nicht Teil dieses Changes
- fuer die erste, billigste Statuslogik darf jeder technisch erfolgreiche echte DB-Zugriff den sichtbaren Status unmittelbar wieder auf `ok` setzen

Wenn die aktuell konfigurierte Waste-Datenquelle nicht erreichbar ist, darf das Modul nicht einfach vollstaendig unbenutzbar werden:

- die Einstellungen zur Waste-Datenquelle muessen weiterhin erreichbar bleiben
- Verbindungsdaten muessen aktualisiert werden koennen, etwa wenn eine Supabase-Datenbank umgezogen wurde
- Connection-Tests und Statuspruefungen muessen serverseitig ausfuehrbar bleiben
- fachliche CRUD-Operationen gegen Waste-Daten duerfen fehlschlagen, aber die Rekonfiguration der Datenquelle darf dadurch nicht blockiert werden

### 3f. Migrationsmodell pro Instanz

Schema-Migrationen fuer die Waste-Fachdatenbank werden instanzbezogen und plugingefuehrt angeboten.

- Beim ersten Start des Plugins fuer eine Instanz muss erkennbar sein, ob die zugeordnete Waste-Datenbank initialisiert werden muss.
- Nach einem Plugin-Update muss erkennbar sein, ob fuer die Instanz ausstehende Waste-Migrationen vorliegen.
- Die Migrationen werden nicht blind im Hintergrund erzwungen, sondern im Plugin beziehungsweise ueber die Host-Fassade als ausfuehrbare Admin-Operation angeboten.
- Auch Migrationen sind hochrelevante technische Operationen und muessen nachvollziehbar protokolliert werden.

### 3b. Terminlogik fuer Einzelverschiebungen

Wiederkehrende Touren werden nicht nur durch starre Rhythmen beschrieben. Das Zielbild muss manuelle Einzelverschiebungen fachlich verarbeiten koennen.

- Eine Verschiebung einzelner Termine darf nicht nur als isolierte Notiz behandelt werden.
- Die Fachlogik muss ausdruecklich modellieren koennen, ob eine Einzelkorrektur nur den Einzeltermin betrifft oder die nachfolgende Serienlogik beeinflusst.
- Das konkrete Regelwerk wird implementierungsseitig praezisiert, der Change fixiert aber bereits, dass Folgeeffekte fachlich unterstuetzt werden muessen.

### 3c. Feiertags- und Adressmodell

Das Waste-Management-Zielbild muss die im Konzept genannten fachlichen Basismodelle ausdruecklich tragen:

- Feiertage und andere globale Abweichungsgruende sind eigenstaendige Ausloeser fuer Terminverschiebungen und nicht nur freie Kommentarfelder.
- Die Adresslogik folgt der Hierarchie `Ort -> Strasse -> Hausnummer`, wobei nachgelagerte Auswahlmengen von der vorangehenden Ebene abhaengen.
- Das Datenmodell muss diese Hierarchie sowohl fuer redaktionelle Pflege als auch fuer spaetere kanalbezogene Auswahl- und Personalisierungsfluesse abbilden koennen.

### 3d. Mehrsprachige und farbcodierte Fachstammdaten

Abfallarten und fachnahe Darstellungen muessen nicht nur technisch verwaltbar, sondern auch fuer verschiedene Kanaele ausspielbar bleiben.

- Fachstammdaten muessen mehrsprachige Bezeichnungen tragen koennen.
- Farbcodes fuer Abfallarten oder Tourdarstellungen sind Teil des fachlichen Vertrags und nicht nur reine UI-Dekoration.
- Das Zielbild bleibt damit kompatibel zu spaeteren Kalender-, Push- oder App-Darstellungen, ohne diese in diesem Change schon umzusetzen.

### 4. IAM und Hochrisiko-Operationen

Das Modul erhaelt einen feingranularen Namespace `waste-management.*`. Das Zielbild trennt mindestens:

- `waste-management.read`
- `waste-management.master-data.manage`
- `waste-management.tours.manage`
- `waste-management.scheduling.manage`
- `waste-management.import.execute`
- `waste-management.seed.execute`
- `waste-management.reset.execute`
- `waste-management.settings.manage`

Reset bleibt auch fuer Produktivumgebungen zulaessig, aber nur mit:

- separatem Hochrisiko-Recht
- expliziter mehrstufiger Bestaetigung
- klarer Scope-Anzeige
- Audit-Event mit Instanz-, Actor- und Ergebniskontext

Das gilt nicht nur serverseitig. Die UI muss schreibende und gefaehrliche Aktionen konsequent aus Rechten ableiten:

- rein lesende Nutzer sehen keine impliziten Schreibpfade
- gefaehrliche Tools wie Seed und Reset erscheinen nur mit den dafuer vorgesehenen Rechten
- die UI darf keine zweite, lockerere Rechteinterpretation neben dem Host etablieren

### 5. Audit und Historie

Verlauf/Historie wird fuer das Modul nicht ueber eigene Primairtabellen geloest, sondern ueber die Studio-Audit-Basis modelliert:

- alle Mutationen erzeugen Audit-Events
- Seed, Reset und CSV-Import tragen erweiterte sichere Metadaten
- fachliche Verlaufsansichten lesen in diesem Change aus der einfachsten tragfaehigen Loesung auf Basis derselben Auditspur; dedizierte Read-Modelle bleiben optional

Warum:
- Das vermeidet parallele Revisions- und Verlaufssysteme.
- Sicherheitskritische Operationen muessen ohnehin revisionsfaehig im zentralen Auditvertrag sichtbar sein.

### 5a. Asynchrone Data-Tools

CSV-Import, Seed, Reset und Waste-Schema-Migrationen werden als asynchrone Operationen modelliert.

- Ausloesen und Statusabfrage sind getrennte Schritte.
- Langlaufende Operationen blockieren nicht die normale Request-Laufzeit.
- Ergebnisse, Fehler und Fortschrittsstatus muessen fuer Administratoren nachvollziehbar rueckgemeldet werden.
- Reset bezieht sich nur auf Waste-Fachdaten der aktiven Instanz und nicht auf die technische Datenquellenkonfiguration im Studio-Postgres.

Die zugrunde liegende Job-Orchestrierung soll nicht waste-spezifisch bleiben, sondern als generische Studio-Faehigkeit gedacht werden:

- das Studio stellt ein allgemeines, pluginuebergreifendes Jobmodell bereit
- das Waste-Plugin nutzt dieses Jobmodell fuer Import, Seed, Reset und Migrationen mit eigenen Jobtypen oder plugin-spezifischem Payload
- restart-sichere Persistenz, Status und Lifecycle gehoeren zur allgemeinen Studio-Faehigkeit und nicht als einmalige Sonderlogik in das Waste-Plugin
- die zentrale Persistenz dieser allgemeinen Job-Faehigkeit liegt im Studio-Postgres
- die erste feste Statusmenge dieser allgemeinen Job-Faehigkeit umfasst mindestens `queued`, `running`, `succeeded`, `failed`, `cancelled`
- automatische Retry-Logik ist in dieser ersten Ausbaustufe bewusst nicht enthalten
- fehlgeschlagene oder abgebrochene Jobs werden in dieser ersten Ausbaustufe nicht in-place neu gestartet; stattdessen wird bei Bedarf ein neuer Job angelegt
- `cancelled` wird in dieser ersten Ausbaustufe bereits als Status reserviert, ohne dass damit schon fuer alle Jobtypen ein echter Abbruchpfad garantiert werden muss
- die allgemeine Job-Faehigkeit soll nicht nur technisch wiederverwendbar, sondern auch im UI als pluginuebergreifendes Studio-Konzept sichtbar sein
- die erste zentrale UI-Verankerung dieser allgemeinen Job-Faehigkeit erfolgt unter dem bestehenden Sidebar-Punkt `Monitoring`
- ein spaeteres Desktop-Widget fuer Monitoring oder Jobs bleibt moeglich, ist aber nicht Teil dieses Changes
- die erste konkrete `Monitoring`-Sicht bleibt eine technische und zunaechst temporaere Admin-Sicht
- sie darf Jobs, aktuellen technischen Datenquellenstatus und technische Ereignishistorie kombinieren
- eine breitere fachliche Betriebsoberflaeche wird in diesem Change noch nicht festgelegt
- plugininterne technische Hilfsdaten koennen weiterhin in der externen Waste-Datenbank liegen, die uebergreifende Job-Orchestrierung und ihre fuehrende Persistenz im Studio-Postgres werden dadurch aber nicht ersetzt

Diese Plattformfaehigkeit wird in diesem Change bewusst nicht nur als schmale Vorstufe angelegt. Sie soll bereits im ersten Wurf tragfaehig genug fuer weitere reale Plugin-Nutzer sein, solange Waste der erste konkrete Treiber bleibt.

Die Andockstelle dafuer soll explizit ueber das Plugin-Modell des Studios laufen:

- Plugins registrieren ueber `@sva/plugin-sdk` ihre fachlichen Jobtypen
- Plugins registrieren ueber `@sva/plugin-sdk` ihre fachlichen Importprofile
- das Studio liefert dazu die allgemeine Runtime, Persistenz, UI und Orchestrierung
- Plugins beschreiben also Fachvertraege, das Studio uebernimmt die generische Ausfuehrung

### 5b. Generische Import-Faehigkeit und Mapping

Auch strukturierte Datenimporte sollen nicht als Waste-Sonderloesung enden. Das Studio bekommt dafuer eine generische Import-Faehigkeit, die bereits in diesem Change als substanzielle Plattformbasis fuer weitere Plugins angelegt wird.

- das Studio stellt einen allgemeinen Import-Rahmen fuer CSV, Excel sowie schema-nahe JSON- und XML-Quellen bereit
- dieser Rahmen deckt Upload, Vorpruefung, Quellformat-Erkennung, Spalten- oder Feldmapping, Validierung, asynchronen Importjob und Ergebnisdarstellung ab
- Plugins definieren fachliche Importprofile, das Studio stellt die generische Laufzeit- und Bedienlogik bereit
- diese pluginseitigen Importprofile werden ueber einen expliziten Plugin-Vertrag registriert statt nur lose neben der Runtime zu existieren
- Waste ist nur der erste Nutzer dieser allgemeinen Import-Faehigkeit

Die erste allgemeine Import-Oberflaeche wird als mehrstufiger Wizard gedacht:

- Quelle waehlen
- Importprofil waehlen
- Mapping pruefen oder korrigieren
- Validierungsvorschau ansehen
- Import als Job starten
- Ergebnis, Fehler und Importprotokoll einsehen

Ein Importprofil beschreibt mindestens:

- fachlichen Importtyp und technische Kennung
- Zielfelder und Pflichtfelder
- erlaubte Quellformate
- kanonische Vorlage mit Beispielspalten und bei Bedarf Beispieldateien
- Mapping-Regeln und Normalisierungshinweise
- fachliche und technische Validierungen

Fuer Waste werden in diesem Change mindestens drei solche Importprofile verpflichtend vorgesehen:

- `geografie-abholorte`
- `touren`
- `ausweichtermine`

Jeder dieser Importtypen behaelt:

- ein eigenes explizites Spaltenschema
- eine eigene Vorlage
- eine eigene Validierung

Warum:

- Ein einziger "Universalimport" fuehrt schnell zu unscharfen Fehlervertraegen und schwer wartbaren Sonderregeln.
- Getrennte Profile bleiben fuer Nutzer, Tests und spaetere Weiterentwicklung deutlich klarer.
- Das Studio lernt damit eine allgemeine Importfaehigkeit, ohne Waste-spezifische Feldlogik in die Plattform zu ziehen.

Fuer das Mapping selbst gilt:

- das Studio darf automatische Mapping-Vorschlaege fuer Quellspalten oder Quellfelder erzeugen
- diese Vorschlaege bleiben immer pruef- und manuell korrigierbar
- die erste Ausbaustufe darf einfache heuristische Vorschlaege wie Schreibvarianten, Umlaute oder naheliegende Aliasnamen beruecksichtigen
- das Studio darf zusaetzlich einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil vorhalten
- diese gespeicherten Mappings dienen der Wiederverwendung haeufiger Importlaeufe, ohne bereits eine komplexe Versionierungs- oder Freigabelogik einzufuehren
- die Schnittstelle fuer Mapping-Vorschlaege wird bewusst so geschnitten, dass spaeter eine externe KI-basierte Vorschlagslogik angeschlossen werden kann
- diese spaetere KI-Anbindung ist in diesem Change ausdruecklich noch nicht Teil der produktiven Architektur, die Integrationsstelle soll aber leicht wiederauffindbar und austauschbar bleiben

### 5c. UI-Grenze zwischen Plugin und allgemeiner Studio-UI

Die Waste-Oberflaeche enthaelt mehrere starke Interaktionsmuster, aber nicht jedes sichtbare Element ist deshalb ein allgemeiner Plattformbaustein. Die Schnittgrenze muss bewusst zwischen wiederverwendbarer Bedienlogik und Waste-spezifischer Fachoberflaeche gezogen werden.

Als allgemeine Studio-UI-Bausteine kommen in diesem Change insbesondere in Betracht:

- generischer Import-Dialog-Flow mit Upload, Mapping, Validierung, Job-Start und Ergebnisansicht
- generische Job- und Monitoring-Darstellung
- generische Tabellen- und Bulk-Action-Muster
- generische Hochrisiko-Confirm-Dialoge
- generische technische Statusanzeigen fuer Datenquellen und langlaufende Operationen

Diese Bausteine gehoeren nach `packages/studio-ui-react`, sofern sie nicht bereits in passender Form vorhanden sind.

Bewusst fachlich im Waste-Plugin verbleiben:

- die Waste-Hauptseite und ihre fachliche Orchestrierung
- der Jahreskalender fuer Tourtermine
- Dialoge fuer Touren, Ausweichtermine, Abholorte, Fraktionen und Zuordnungen
- Waste-spezifische Filter-, Formular- und Terminlogik

Warum:

- Wiederverwendbare Interaktionsmuster helfen auch spaeteren Plugins und staerken die Plattform.
- Fachdialoge und Jahreskalender tragen bereits zu viel Waste-spezifische Semantik, um als allgemeine UI-Komponenten glaubwuerdig neutral zu bleiben.
- Eine zu fruehe Zentralisierung solcher Fachkomponenten wuerde die UI-Library mit versteckter Pluginlogik aufladen.

### 6. Portierungsstrategie gegen `Newcms`

`Newcms` darf fuer Waste-Management als starke UX- und Fachreferenz dienen. Das Ziel ist ausdruecklich nicht, die Oberflaeche kuenstlich neu zu erfinden. Gleichzeitig darf ein optisch aehnlicher Port nicht zu einer verdeckten Architekturuebernahme fuehren.

Zulaessig zur Uebernahme oder engen Anlehnung sind:

- Seitenzuschnitt, Informationsarchitektur und Tab-Struktur
- Tabellenaufbau, Spaltenlogik, Filterfuehrung und Dialogabfolgen
- Formulare, Feldgruppen und fachliche Benennungen
- rein praesentationale Komponenten oder View-Model-Logik, sofern sie auf Studio-Contracts umgestellt werden
- UX-Muster fuer Bulk-Flows, Konflikthinweise, Fehlerdarstellung und gefaehrliche Bestaetigungen

Nicht zulaessig zur produktiven Uebernahme sind:

- `Newcms`-Hooks fuer Datenladen, Mutation, Auth oder Kontextauflosung
- `Newcms`-API-Clients, Edge-Functions oder direkte Supabase-Aufrufe
- `Newcms`-spezifische Zustandscontainer, globale Stores oder implizite Datenlebenszyklen
- `Newcms`-Berechtigungslogik, die nicht auf `waste-management.*` und Host-Guards gemappt wurde
- `Newcms`-Datenmodelle oder DTOs als stillschweigender Studio-Vertrag
- `Newcms`-Annahmen ueber Singleton-Datenhaltung, globale Datensaetze oder fehlende Instanzgrenzen

Jedes aus `Newcms` uebernommene Artefakt muss vor produktiver Nutzung einer der folgenden Studio-Grenzen eindeutig zugeordnet werden:

- `packages/plugin-waste-management`: praesentationale UI, lokale View-Model-Logik, Plugin-spezifische Bedienablaeufe
- `packages/routing`: Route-Materialisierung, Search-Params, Guards
- `packages/auth-runtime` und `packages/server-runtime`: Host-API, Actor-Kontext, Datenquellenauflosung, Fehlervertrag
- `packages/data` und `packages/data-repositories`: Studio-Governance-Persistenz, technische Settings und hostseitige Waste-Repositories
- `packages/iam-admin` und `packages/iam-governance`: Rollen, Rechte, Audit, Governance-Sichten

Der Port ist daher als Anti-Corruption-Strategie zu verstehen:

- `Newcms` liefert fachliche Referenz und moegliches Quellmaterial
- Studio definiert die produktiven Laufzeitvertraege
- jeder Portierungsschritt mappt UI und Fachkonzepte explizit auf Studio-Packages und Studio-Contracts
- kein uebernommenes Artefakt darf eine zweite, implizite Architekturgrenze neben dem Studio etablieren

Vor jeder groesseren Uebernahme aus `Newcms` muss das Team fuer das betroffene Artefakt dokumentieren:

- was konkret uebernommen wird
- ob es rein praesentational ist oder fachliche Logik enthaelt
- in welches Studio-Package die Verantwortung faellt
- welche `Newcms`-Abhaengigkeiten entfernt oder ersetzt werden muessen
- wie Routing, Datenzugriff, Rechte und Audit auf Studio-Vertraege gemappt werden

Ein optisch fast `1:1` uebernommenes UI ist damit zulaessig. Ein technisch fast `1:1` uebernommener Laufzeit- oder Datenvertrag ist ausdruecklich nicht zulaessig.

## API Surface

Die Host-Fassade kapselt mindestens folgende Ressourcengruppen:

- `fractions`
- `regions`
- `cities`
- `streets`
- `house-numbers`
- `collection-locations`
- `tours`
- `tour-date-shifts`
- `global-date-shifts`
- `location-tour-links`
- `imports/csv`
- `tools/seed`
- `tools/reset`
- `tools/migrations`
- `settings`

Der genaue HTTP-Zuschnitt bleibt implementierungsseitig frei, solange Namespace, Instanzscoping, Rechtezuordnung, asynchrones Jobmodell und Fehlervertrag konsistent bleiben.

Unter `settings` muss der Change mindestens die instanzbezogene Pflege der Waste-Datenquelle ermoeglichen:

- Pflegen der Verbindungsdaten fuer genau eine Waste-Datenquelle der Instanz
- Validieren und nachvollziehbares Rueckmelden, ob die konfigurierte Waste-Datenquelle fuer die Instanz erreichbar ist
- Weiterarbeiten an der Rekonfiguration auch dann, wenn die bisherige Waste-Datenquelle nicht mehr erreichbar ist

Zusaetzlich muss der API-/Service-Zuschnitt den aktuellen Primaermodus sauber tragen und spaetere Erweiterungen nicht verbauen:

- originäre Studio-Pflege
- spaetere Uebernahme oder Synchronisation aus einem extern fuehrenden System darf architektonisch moeglich bleiben, ist aber nicht Teil dieses Changes

Die Fassade muss ausserdem ausreichend fachliche Filter- und Listenabfragen fuer den Admin-Betrieb unterstuetzen, insbesondere fuer:

- Abfallarten
- Adresshierarchien
- Touren und deren Status
- Abweichungs- und Feiertagskontexte

## Risks / Trade-offs

- Instanzisierung des vorhandenen Schemas ist der groesste Migrationshebel und kann historische `Newcms`-Daten aufraeumen muessen.
- Der Betrieb einer eigenen Waste-Datenbank pro Instanz erhoeht den Aufwand fuer Datenquellenpflege, Erreichbarkeitspruefung und Migrationsmanagement.
- Eine freie Plugin-Route bietet fachlich mehr Freiheit, verlangt aber mehr Sorgfalt bei Search-Param-, Empty-/Error-State- und Accessibility-Standards.
- Reset in Produktion ist fachlich gewollt, erhoeht aber die Anforderungen an Rechtemodell, Audit und explizite Bestaetigung im UI.

## Migration Plan

1. Capability und Zielvertraege in OpenSpec festziehen.
2. Schema-Zielbild und Migrationspfad fuer Instanzbezug spezifizieren.
3. Plugin-, Routing-, IAM- und Auditvertraege implementieren.
4. Datenzugriff und Fassade hostseitig aufbauen.
5. `Newcms`-MVP fachlich in Studio-UI ueberfuehren, ohne Code direkt zu portieren.

## Package Impact and Execution Slices

Die Umsetzung soll nicht als ein einzelner Block erfolgen, sondern in getrennten Package-Slices, damit die Bearbeitung und Review-Grenzen klar bleiben.

### Slice A: Neues Fachplugin und Admin-UI

- `packages/plugin-waste-management`: fachliche Seiten, Dialoge, Tabellen, Formulare, Search-Params, Host-API-Client, Modul-IAM- und Audit-Definitionen
- `packages/plugin-sdk`: falls fuer freie Fachplugins neue Hilfen fuer Audit, Settings oder Host-Fetching benoetigt werden
- `packages/studio-ui-react`: wiederverwendbare Tabellen-, Dialog-, Confirm- oder Statusbausteine, sofern bestehende UI-Bausteine fuer Waste-Management nicht ausreichen
- `apps/sva-studio-react`: statische Plugin-Registrierung, Shell-Integration und eventuelle Admin-Einstellungsseiten fuer instanzbezogene Waste-Konfiguration

### Slice B: Routing und Runtime-Anbindung

- `packages/routing`: freie Plugin-Route `/plugins/waste-management`, Search-Param-Vertrag, Host-Route-Registrierung fuer `/api/v1/waste-management/*`, Guards und Sichtbarkeitslogik
- `packages/auth-runtime`: Einhaengen der Waste-HTTP-Endpunkte in die bestehende Runtime, Auth-, Actor- und Request-Context-Aufloesung fuer Waste-Requests
- `packages/server-runtime`: gemeinsame Runtime-Helfer fuer Logging, Fehlerabbildung, Request-Kontext, Secret- und Datenquellenauflosung

### Slice C: Zentrale Governance- und Instanzkonfiguration

- `packages/instance-registry`: instanzbezogene technische Modulkonfiguration fuer die Waste-Datenquelle im zentralen Studio-Postgres, inklusive Read-/Write-Modelle fuer Admin-Ansichten
- `packages/data-repositories`: primaere Heimat fuer Persistenz der Waste-Datenquellen-Konfiguration, zentrale Governance-Queries, technische Settings-Validierung und Datenzugriff auf Studio-Postgres sowie fuer spaetere Waste-Fachdatenbank-Repositories
- `packages/data`: nur falls noetig eine duenne Orchestrierungs- oder Kompositionsschicht, aber keine neue primaere Heimat fuer Waste-SQL
- `packages/core`: gemeinsame Contracts fuer Waste-Settings, Datenquellenstatus und instanzbezogene Verwaltungsmodelle, falls diese package-uebergreifend gebraucht werden

### Slice D: Waste-Host-Fassade, IAM und Audit

- `packages/auth-runtime` oder ein gleichwertiger Host-Runtime-Einstiegspunkt: HTTP-Handler fuer `/api/v1/waste-management/*`
- `packages/server-runtime`: serverseitige Aufloesung der aktiven Waste-Datenquelle, Secret-Nutzung und technische Fehlervertraege
- `packages/data-repositories`: hostseitige Repositories fuer Waste-Fachdatenbankzugriffe gegen die `waste_*`-Tabellenfamilie
- `packages/iam-admin`: Integration der neuen `waste-management.*` Rechte in Rollen- und Permission-Verwaltung, soweit die bestehenden IAM-Admin-Flows diese zentral pflegen
- `packages/iam-governance`: zentrale Audit-Auswertung, Audit-Read-Modelle oder Governance-Sichten fuer Waste-Mutationen, sofern diese im Studio sichtbar gemacht werden

### Slice E: Tests, Dokumentation und Architektur

- `apps/sva-studio-react`: E2E- und Integrationspfade fuer Plugin, Rechte und Einstellungen
- `packages/plugin-waste-management`, `packages/routing`, `packages/auth-runtime`, `packages/data`, `packages/data-repositories`, `packages/instance-registry`: Unit- und Type-Tests entlang der jeweiligen Slice-Verantwortung
- `docs/architecture/*`: Arc42-Fortschreibung fuer Persistenzgrenzen, Instanzkonfiguration und Runtime-Boundaries

Jeder dieser Slices soll im Change als eigener Task-Abschnitt gefuehrt werden, damit Umsetzung, Review und Tests getrennt geplant und abgenommen werden koennen.

## Open Questions

- Die konkrete Ausgestaltung eines spaeteren sekundaeren Fremdsystem-Modus bleibt offen.
- Konfliktregeln zwischen Synchronisation und manueller Pflege bleiben offen.
- Die genaue Menge URL-stabiler Detail- oder Editorzustaende wird implementierungsnah innerhalb des hier gesetzten Routing-Rahmens finalisiert.
