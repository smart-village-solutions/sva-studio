## Context

Im `Newcms` existiert ein fachlicher Abfallkalender-MVP mit React-Oberflächen, einer API-Schicht gegen Supabase-Functions und einem relationalen `waste_*`-Schema. Das Studio besitzt dagegen bereits klare Zielgrenzen:

- Fachoberflächen leben in Workspace-Plugins über `@sva/plugin-sdk`.
- Wiederverwendbare UI kommt aus `@sva/studio-ui-react`.
- Routing, Guards und Search-Param-Validierung bleiben hostgeführt.
- Datenzugriff auf externe oder fachspezifische Systeme wird über schmale Host-Fassaden gekapselt.
- Instanzisolation und Auditierung sind verbindliche Querschnittsanforderungen.

Der Waste-Management-Change muss diese Welten zusammenbringen, ohne `Newcms` als Architektur in das Studio zu kopieren.

## Goals

- Vollständige Admin-Capability für Waste-Management im Studio schaffen
- Freies Plugin `waste-management` mit eigener Fachnavigation unter `/plugins/waste-management`
- Hostgeführte Studio-API für Waste-CRUD, Zuordnungen, CSV-Import, Seed und Reset
- Genau eine Waste-Fachdatenbank pro Studio-Instanz mit klarer technischer Konfiguration im Studio-Postgres
- Fokus auf den Betrieb als führendes Waste-System; sekundäre Führung bleibt als spätere Erweiterungsrichtung architektonisch offen
- Feingranulares Modul-IAM und revisionsfähige Auditspur für alle Mutationen
- Fachlich belastbares Adress-, Feiertags- und Abweichungsmodell für spätere App-/Push-Ausspielung vorbereiten
- `Newcms` nur als fachliche und UX-Referenz nutzen

## Non-Goals

- Keine Bürgerkanal- oder Mobile-Read-API
- Keine Export-/Feed-Schnittstellen
- Keine Übernahme der `Newcms`-Edge-Functions als produktive Backend-Strategie
- Keine Host-owned `adminResource`-Materialisierung als Hauptoberfläche

## Decisions

### 1. Plugin- und Routing-Modell

Das Modul wird als freies Fachplugin `waste-management` modelliert. Die Hauptoberfläche wird unter `/plugins/waste-management` materialisiert und besitzt typisierte Search-Params für:

- aktiven Haupttab
- Such- und Filterzustände
- Paging/Sortierung für Listen
- fokussierte Detail- oder Bearbeitungskontexte
- adressbezogene Auswahl- oder Zuordnungskontexte, wenn sie für Deep-Links oder Wiedereinstieg relevant sind

Warum:
- Die Oberfläche ist kein standardisiertes Content-CRUD, sondern ein komplexer Workflow aus Tabellen, Hierarchien, Bulk-Operationen und Spezialtools.
- Das bestehende host-owned `adminResource`-Muster für Content wäre hier künstlich und würde die Fachnavigation eher verbergen als vereinheitlichen.

### 2. Server-Fassade und Datenzugriff

Das Plugin importiert keinen Supabase-Client und spricht ausschließlich die Studio-Fassade unter `/api/v1/waste-management/*` an. Die Fassade kapselt:

- Autorisierung und Instanzkontext
- Validierung und Fehlerabbildung
- Mapping zwischen HTTP-Vertrag und Datenmodell
- Audit-Auslösung
- serverseitige Auflösung der für die aktive Instanz hinterlegten Waste-Datenquelle
- Datenzugriff auf das `waste_*`-Schema der aufgelösten Waste-Fachdatenbank
- Vorbereitung späterer Upstream-Importe oder Synchronisationsläufe aus führenden Fremdsystemen

Warum:
- Das folgt dem bestehenden Studio-Muster für hostgeführte Persistenzgrenzen.
- Browserseitiger Direktsupabasezugriff würde Instanzisolation, Logging und Sicherheitskontrollen unterlaufen.
- Die `Newcms`-Edge-Functions würden eine zweite Runtime-Grenze mit eigener Fehler- und Auth-Logik einführen.
- Die Auswahl der richtigen Waste-Datenbank pro Instanz darf nicht im Plugin liegen, sondern muss serverseitig aus dem Instanzkontext und der hinterlegten Modulkonfiguration erfolgen.

### 3. Datenmodell und Migration

Die bestehende `waste_*`-Tabellenfamilie ist die Migrationsbasis, aber kein unveränderlicher Vertrag. Das Zielbild trennt zentrale Studio-Governance von Waste-Fachdaten:

- das zentrale Studio-Postgres bleibt System of Record für Instanzen, Rollen, Rechte, Audits und technische Modulkonfiguration
- jede Studio-Instanz erhält genau eine eigene Waste-Fachdatenbank beziehungsweise genau ein eigenes Supabase-Projekt für fachliche Waste-Daten
- die für eine Instanz gültige Waste-Datenquelle wird als serverseitig geschützte Modulkonfiguration verwaltet und über die Host-Fassade aufgelöst
- Waste-Fachdaten werden nicht als reguläres Persistenzmodell in der zentralen Studio-Postgres mitgeführt
- IAM-, Rollen-, Rechte- und Audit-Primärdaten des Studios werden nicht in der externen Waste-Fachdatenbank gespeichert
- Waste-spezifische Migrations-, Job- und sonstige plugininterne Hilfsdaten dürfen in der externen Waste-Fachdatenbank gespeichert werden, solange sie keine zentrale Studio-Governance duplizieren
- zusätzliche Status-, Monitoring- und fortlaufende Historienmetadaten zur Erreichbarkeit, Prüfung und Entwicklung der externen Waste-Datenquelle dürfen zentral im Studio-Postgres gehalten werden

Die Waste-Fachdatenbank selbst ist die Mandantengrenze. Das Zielbild führt Waste-Daten daher ohne zusätzlichen fachlichen `instance_id`-Mandantenschnitt in den Waste-Tabellen:

- bestehende globale Annahmen aus `Newcms` werden bereinigt
- inkompatible Korrekturen sind erlaubt, sofern ein expliziter Migrationspfad dokumentiert wird
- Seed und Reset müssen die aktive Waste-Datenbank der Instanz beachten

Warum:
- Studio-IAM, Routing und Verwaltungslogik arbeiten instanzzentriert.
- Bei genau einer Waste-Datenbank pro Instanz wäre ein zusätzlicher Mandantenschnitt innerhalb derselben Fachdatenbank redundant und fehleranfällig.
- Die Trennung vermeidet, dass fachliche Massendaten, Betriebsrechte und revisionsrelevante Governance-Daten in derselben Persistenzgrenze vermischt werden.

### 3a. Primär- und Sekundärsystem-Modell

Der aktuelle Change fokussiert den Betrieb von SVA Studio als führendes Waste-System.

- Waste-Daten werden originär über das Studio gepflegt.
- Import, Seed und Reset arbeiten auf dieser führenden Datenhaltung.
- Die Host-Fassade bleibt die einzige Plugin-Schnittstelle.
- Die technische Datenquellenkonfiguration pro Instanz bleibt über Studio-Einstellungen pflegbar, ohne dass das Plugin direkte Datenbank-Credentials kennen oder speichern darf.

Sekundäre Führung durch ein externes Fachsystem bleibt für spätere Changes architektonisch zulässig, ist hier aber ausdrücklich nicht fachlich ausdefiniert:

- keine konkrete Fremdsystem-Schnittstelle
- keine Schreibsperren oder Override-Regeln für Sync-Modi
- keine Konfliktlogik zwischen Synchronisation und manueller Pflege

### 3e. Datenquellen-Lebenszyklus und Ausfallverhalten

Die Waste-Datenquelle einer Instanz wird vollständig über die zentrale Studio-Governance konfiguriert.

- Verbindungsdaten liegen im Studio-Postgres.
- Status-, Monitoring- und fortlaufende Historienmetadaten zur externen Waste-Datenquelle dürfen ebenfalls im Studio-Postgres gehalten werden.
- Die Host-Runtime löst daraus die aktive Waste-Datenquelle serverseitig auf.
- Die Konfiguration bleibt über `waste-management.settings.manage` pflegbar.

Die erste verpflichtende Ereignishistorie im Studio-Postgres umfasst mindestens:

- erfolgreiche und fehlgeschlagene Connection-Checks
- Rekonfigurationen der Waste-Datenquelle
- Start, Erfolg und Fehler von Waste-Migrationen
- Start, Erfolg und Fehler von CSV-Importen
- Start, Erfolg und Fehler von Seed-Operationen
- Start, Erfolg und Fehler von Reset-Operationen

Diese erste Historie bleibt bewusst technisch:

- sie dient zunächst der Betriebs- und Monitoring-Sicht auf die externe Datenquelle
- fachliche Einordnungen oder tiefergehende Business-Historien sind in diesem Change kein Pflichtbestandteil

Fehlgeschlagene Connection-Checks wirken nicht nur historisierend:

- sie müssen zusätzlich einen sofort sichtbaren aktuellen Status an der zentralen Instanz-/Plugin-Konfiguration hinterlassen
- Administratoren sollen damit ohne Auswertung der Verlaufshistorie erkennen können, dass die externe Waste-Datenquelle aktuell gestört ist
- erfolgreiche Connection-Checks heben diesen sichtbaren Störungsstatus sofort wieder auf
- die fortlaufende Historie bleibt davon unberührt und bildet den Verlauf weiter ab

Für den aktuellen Change gilt außerdem:

- beim Laden der Settings-Seite darf automatisch ein expliziter Connection-Check ausgeführt werden
- auf anderen Waste-Seiten dürfen erfolgreiche oder fehlgeschlagene echte DB-Zugriffe den sichtbaren technischen Status implizit mitbeeinflussen
- fachliche Fehler ohne Connectivity-Bezug dürfen dabei keinen Störungsstatus setzen
- periodische Hintergrund-Checks oder eigenständige Monitoring-Scheduler sind nicht Teil dieses Changes
- für die erste, billigste Statuslogik darf jeder technisch erfolgreiche echte DB-Zugriff den sichtbaren Status unmittelbar wieder auf `ok` setzen

Wenn die aktuell konfigurierte Waste-Datenquelle nicht erreichbar ist, darf das Modul nicht einfach vollständig unbenutzbar werden:

- die Einstellungen zur Waste-Datenquelle müssen weiterhin erreichbar bleiben
- Verbindungsdaten müssen aktualisiert werden können, etwa wenn eine Supabase-Datenbank umgezogen wurde
- Connection-Tests und Statusprüfungen müssen serverseitig ausführbar bleiben
- fachliche CRUD-Operationen gegen Waste-Daten dürfen fehlschlagen, aber die Rekonfiguration der Datenquelle darf dadurch nicht blockiert werden

### 3f. Migrationsmodell pro Instanz

Schema-Migrationen für die Waste-Fachdatenbank werden instanzbezogen und plugingeführt angeboten.

- Beim ersten Start des Plugins für eine Instanz muss erkennbar sein, ob die zugeordnete Waste-Datenbank initialisiert werden muss.
- Nach einem Plugin-Update muss erkennbar sein, ob für die Instanz ausstehende Waste-Migrationen vorliegen.
- Die Migrationen werden nicht blind im Hintergrund erzwungen, sondern im Plugin beziehungsweise über die Host-Fassade als ausführbare Admin-Operation angeboten.
- Auch Migrationen sind hochrelevante technische Operationen und müssen nachvollziehbar protokolliert werden.

### 3b. Terminlogik für Einzelverschiebungen

Wiederkehrende Touren werden nicht nur durch starre Rhythmen beschrieben. Das Zielbild muss manuelle Einzelverschiebungen fachlich verarbeiten können.

- Eine Verschiebung einzelner Termine darf nicht nur als isolierte Notiz behandelt werden.
- Die Fachlogik muss ausdrücklich modellieren können, ob eine Einzelkorrektur nur den Einzeltermin betrifft oder die nachfolgende Serienlogik beeinflusst.
- Das konkrete Regelwerk wird implementierungsseitig präzisiert, der Change fixiert aber bereits, dass Folgeeffekte fachlich unterstützt werden müssen.

### 3c. Feiertags- und Adressmodell

Das Waste-Management-Zielbild muss die im Konzept genannten fachlichen Basismodelle ausdrücklich tragen:

- Feiertage und andere globale Abweichungsgründe sind eigenständige Auslöser für Terminverschiebungen und nicht nur freie Kommentarfelder.
- Die Adresslogik folgt der Hierarchie `Ort -> Straße -> Hausnummer`, wobei nachgelagerte Auswahlmengen von der vorangehenden Ebene abhängen.
- Das Datenmodell muss diese Hierarchie sowohl für redaktionelle Pflege als auch für spätere kanalbezogene Auswahl- und Personalisierungsflüsse abbilden können.

### 3d. Mehrsprachige und farbcodierte Fachstammdaten

Abfallarten und fachnahe Darstellungen müssen nicht nur technisch verwaltbar, sondern auch für verschiedene Kanäle ausspielbar bleiben.

- Fachstammdaten müssen mehrsprachige Bezeichnungen tragen können.
- Farbcodes für Abfallarten oder Tourdarstellungen sind Teil des fachlichen Vertrags und nicht nur reine UI-Dekoration.
- Das Zielbild bleibt damit kompatibel zu späteren Kalender-, Push- oder App-Darstellungen, ohne diese in diesem Change schon umzusetzen.

### 4. IAM und Hochrisiko-Operationen

Das Modul erhält einen feingranularen Namespace `waste-management.*`. Das Zielbild trennt mindestens:

- `waste-management.read`
- `waste-management.master-data.manage`
- `waste-management.tours.manage`
- `waste-management.scheduling.manage`
- `waste-management.import.execute`
- `waste-management.seed.execute`
- `waste-management.reset.execute`
- `waste-management.settings.manage`

Reset bleibt auch für Produktivumgebungen zulässig, aber nur mit:

- separatem Hochrisiko-Recht
- expliziter mehrstufiger Bestätigung
- klarer Scope-Anzeige
- Audit-Event mit Instanz-, Actor- und Ergebniskontext

Das gilt nicht nur serverseitig. Die UI muss schreibende und gefährliche Aktionen konsequent aus Rechten ableiten:

- rein lesende Nutzer sehen keine impliziten Schreibpfade
- gefährliche Tools wie Seed und Reset erscheinen nur mit den dafür vorgesehenen Rechten
- die UI darf keine zweite, lockerere Rechteinterpretation neben dem Host etablieren

### 5. Audit und Historie

Verlauf/Historie wird für das Modul nicht über eigene Primärtabellen gelöst, sondern über die Studio-Audit-Basis modelliert:

- alle Mutationen erzeugen Audit-Events
- Seed, Reset und CSV-Import tragen erweiterte sichere Metadaten
- fachliche Verlaufsansichten lesen in diesem Change aus der einfachsten tragfähigen Lösung auf Basis derselben Auditspur; dedizierte Read-Modelle bleiben optional

Warum:
- Das vermeidet parallele Revisions- und Verlaufssysteme.
- Sicherheitskritische Operationen müssen ohnehin revisionsfähig im zentralen Auditvertrag sichtbar sein.

### 5a. Asynchrone Data-Tools

CSV-Import, Seed, Reset und Waste-Schema-Migrationen werden als asynchrone Operationen modelliert.

- Auslösen und Statusabfrage sind getrennte Schritte.
- Langlaufende Operationen blockieren nicht die normale Request-Laufzeit.
- Ergebnisse, Fehler und Fortschrittsstatus müssen für Administratoren nachvollziehbar rückgemeldet werden.
- Reset bezieht sich nur auf Waste-Fachdaten der aktiven Instanz und nicht auf die technische Datenquellenkonfiguration im Studio-Postgres.

Die zugrunde liegende Job-Orchestrierung soll nicht waste-spezifisch bleiben, sondern als generische Studio-Fähigkeit gedacht werden:

- das Studio stellt ein allgemeines, pluginübergreifendes Jobmodell bereit
- das Waste-Plugin nutzt dieses Jobmodell für Import, Seed, Reset und Migrationen mit eigenen Jobtypen oder plugin-spezifischem Payload
- restart-sichere Persistenz, Status und Lifecycle gehören zur allgemeinen Studio-Fähigkeit und nicht als einmalige Sonderlogik in das Waste-Plugin
- die zentrale Persistenz dieser allgemeinen Job-Fähigkeit liegt im Studio-Postgres
- die erste feste Statusmenge dieser allgemeinen Job-Fähigkeit umfasst mindestens `queued`, `running`, `succeeded`, `failed`, `cancelled`
- automatische Retry-Logik ist in dieser ersten Ausbaustufe bewusst nicht enthalten
- fehlgeschlagene oder abgebrochene Jobs werden in dieser ersten Ausbaustufe nicht in-place neu gestartet; stattdessen wird bei Bedarf ein neuer Job angelegt
- `cancelled` wird in dieser ersten Ausbaustufe bereits als Status reserviert, ohne dass damit schon für alle Jobtypen ein echter Abbruchpfad garantiert werden muss
- die allgemeine Job-Fähigkeit soll nicht nur technisch wiederverwendbar, sondern auch im UI als pluginübergreifendes Studio-Konzept sichtbar sein
- die erste zentrale UI-Verankerung dieser allgemeinen Job-Fähigkeit erfolgt unter dem bestehenden Sidebar-Punkt `Monitoring`
- ein späteres Desktop-Widget für Monitoring oder Jobs bleibt möglich, ist aber nicht Teil dieses Changes
- die erste konkrete `Monitoring`-Sicht bleibt eine technische und zunächst temporäre Admin-Sicht
- sie darf Jobs, aktuellen technischen Datenquellenstatus und technische Ereignishistorie kombinieren
- eine breitere fachliche Betriebsoberfläche wird in diesem Change noch nicht festgelegt
- plugininterne technische Hilfsdaten können weiterhin in der externen Waste-Datenbank liegen, die übergreifende Job-Orchestrierung soll aber auf Wiederverwendung für weitere Plugins ausgelegt werden

Diese Plattformfähigkeit wird in diesem Change bewusst nicht nur als schmale Vorstufe angelegt. Sie soll bereits im ersten Wurf tragfähig genug für weitere reale Plugin-Nutzer sein, solange Waste der erste konkrete Treiber bleibt.

Die Andockstelle dafür soll explizit über das Plugin-Modell des Studios laufen:

- Plugins registrieren über `@sva/plugin-sdk` ihre fachlichen Jobtypen
- Plugins registrieren über `@sva/plugin-sdk` ihre fachlichen Importprofile
- das Studio liefert dazu die allgemeine Runtime, Persistenz, UI und Orchestrierung
- Plugins beschreiben also Fachverträge, das Studio übernimmt die generische Ausführung

### 5b. Generische Import-Fähigkeit und Mapping

Auch strukturierte Datenimporte sollen nicht als Waste-Sonderlösung enden. Das Studio bekommt dafür eine generische Import-Fähigkeit, die bereits in diesem Change als substanzielle Plattformbasis für weitere Plugins angelegt wird.

- das Studio stellt einen allgemeinen Import-Rahmen für CSV, Excel sowie schema-nahe JSON- und XML-Quellen bereit
- dieser Rahmen deckt Upload, Vorprüfung, Quellformat-Erkennung, Spalten- oder Feldmapping, Validierung, asynchronen Importjob und Ergebnisdarstellung ab
- Plugins definieren fachliche Importprofile, das Studio stellt die generische Laufzeit- und Bedienlogik bereit
- diese pluginseitigen Importprofile werden über einen expliziten Plugin-Vertrag registriert statt nur lose neben der Runtime zu existieren
- Waste ist nur der erste Nutzer dieser allgemeinen Import-Fähigkeit

Die erste allgemeine Import-Oberfläche wird als mehrstufiger Wizard gedacht:

- Quelle wählen
- Importprofil wählen
- Mapping prüfen oder korrigieren
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

Für Waste werden in diesem Change mindestens drei solche Importprofile verpflichtend vorgesehen:

- `geografie-abholorte`
- `touren`
- `ausweichtermine`

Jeder dieser Importtypen behält:

- ein eigenes explizites Spaltenschema
- eine eigene Vorlage
- eine eigene Validierung

Warum:

- Ein einziger "Universalimport" führt schnell zu unscharfen Fehlerverträgen und schwer wartbaren Sonderregeln.
- Getrennte Profile bleiben für Nutzer, Tests und spätere Weiterentwicklung deutlich klarer.
- Das Studio lernt damit eine allgemeine Importfähigkeit, ohne Waste-spezifische Feldlogik in die Plattform zu ziehen.

Für das Mapping selbst gilt:

- das Studio darf automatische Mapping-Vorschläge für Quellspalten oder Quellfelder erzeugen
- diese Vorschläge bleiben immer prüf- und manuell korrigierbar
- die erste Ausbaustufe darf einfache heuristische Vorschläge wie Schreibvarianten, Umlaute oder naheliegende Aliasnamen berücksichtigen
- das Studio darf zusätzlich einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil vorhalten
- diese gespeicherten Mappings dienen der Wiederverwendung häufiger Importläufe, ohne bereits eine komplexe Versionierungs- oder Freigabelogik einzuführen
- die Schnittstelle für Mapping-Vorschläge wird bewusst so geschnitten, dass später eine externe KI-basierte Vorschlagslogik angeschlossen werden kann
- diese spätere KI-Anbindung ist in diesem Change ausdrücklich noch nicht Teil der produktiven Architektur, die Integrationsstelle soll aber leicht wiederauffindbar und austauschbar bleiben

### 5c. UI-Grenze zwischen Plugin und allgemeiner Studio-UI

Die Waste-Oberfläche enthält mehrere starke Interaktionsmuster, aber nicht jedes sichtbare Element ist deshalb ein allgemeiner Plattformbaustein. Die Schnittgrenze muss bewusst zwischen wiederverwendbarer Bedienlogik und Waste-spezifischer Fachoberfläche gezogen werden.

Als allgemeine Studio-UI-Bausteine kommen in diesem Change insbesondere in Betracht:

- generischer Import-Dialog-Flow mit Upload, Mapping, Validierung, Job-Start und Ergebnisansicht
- generische Job- und Monitoring-Darstellung
- generische Tabellen- und Bulk-Action-Muster
- generische Hochrisiko-Confirm-Dialoge
- generische technische Statusanzeigen für Datenquellen und langlaufende Operationen

Diese Bausteine gehören nach `packages/studio-ui-react`, sofern sie nicht bereits in passender Form vorhanden sind.

Bewusst fachlich im Waste-Plugin verbleiben:

- die Waste-Hauptseite und ihre fachliche Orchestrierung
- der Jahreskalender für Tourtermine
- Dialoge für Touren, Ausweichtermine, Abholorte, Fraktionen und Zuordnungen
- Waste-spezifische Filter-, Formular- und Terminlogik

Warum:

- Wiederverwendbare Interaktionsmuster helfen auch späteren Plugins und stärken die Plattform.
- Fachdialoge und Jahreskalender tragen bereits zu viel Waste-spezifische Semantik, um als allgemeine UI-Komponenten glaubwürdig neutral zu bleiben.
- Eine zu frühe Zentralisierung solcher Fachkomponenten würde die UI-Library mit versteckter Pluginlogik aufladen.

### 6. Portierungsstrategie gegen `Newcms`

`Newcms` darf für Waste-Management als starke UX- und Fachreferenz dienen. Das Ziel ist ausdrücklich nicht, die Oberfläche künstlich neu zu erfinden. Gleichzeitig darf ein optisch ähnlicher Port nicht zu einer verdeckten Architekturübernahme führen.

Zulässig zur Übernahme oder engen Anlehnung sind:

- Seitenzuschnitt, Informationsarchitektur und Tab-Struktur
- Tabellenaufbau, Spaltenlogik, Filterführung und Dialogabfolgen
- Formulare, Feldgruppen und fachliche Benennungen
- rein präsentationale Komponenten oder View-Model-Logik, sofern sie auf Studio-Contracts umgestellt werden
- UX-Muster für Bulk-Flows, Konflikthinweise, Fehlerdarstellung und gefährliche Bestätigungen

Nicht zulässig zur produktiven Übernahme sind:

- `Newcms`-Hooks für Datenladen, Mutation, Auth oder Kontextauflosung
- `Newcms`-API-Clients, Edge-Functions oder direkte Supabase-Aufrufe
- `Newcms`-spezifische Zustandscontainer, globale Stores oder implizite Datenlebenszyklen
- `Newcms`-Berechtigungslogik, die nicht auf `waste-management.*` und Host-Guards gemappt wurde
- `Newcms`-Datenmodelle oder DTOs als stillschweigender Studio-Vertrag
- `Newcms`-Annahmen über Singleton-Datenhaltung, globale Datensätze oder fehlende Instanzgrenzen

Jedes aus `Newcms` übernommene Artefakt muss vor produktiver Nutzung einer der folgenden Studio-Grenzen eindeutig zugeordnet werden:

- `packages/plugin-waste-management`: präsentationale UI, lokale View-Model-Logik, Plugin-spezifische Bedienabläufe
- `packages/routing`: Route-Materialisierung, Search-Params, Guards
- `packages/auth-runtime` und `packages/server-runtime`: Host-API, Actor-Kontext, Datenquellenauflösung, Fehlervertrag
- `packages/data` und `packages/data-repositories`: Studio-Governance-Persistenz, technische Settings und hostseitige Waste-Repositories
- `packages/iam-admin` und `packages/iam-governance`: Rollen, Rechte, Audit, Governance-Sichten

Der Port ist daher als Anti-Corruption-Strategie zu verstehen:

- `Newcms` liefert fachliche Referenz und mögliches Quellmaterial
- Studio definiert die produktiven Laufzeitverträge
- jeder Portierungsschritt mappt UI und Fachkonzepte explizit auf Studio-Packages und Studio-Contracts
- kein übernommenes Artefakt darf eine zweite, implizite Architekturgrenze neben dem Studio etablieren

Vor jeder größeren Übernahme aus `Newcms` muss das Team für das betroffene Artefakt dokumentieren:

- was konkret übernommen wird
- ob es rein präsentational ist oder fachliche Logik enthält
- in welches Studio-Package die Verantwortung fällt
- welche `Newcms`-Abhängigkeiten entfernt oder ersetzt werden müssen
- wie Routing, Datenzugriff, Rechte und Audit auf Studio-Verträge gemappt werden

Ein optisch fast `1:1` übernommenes UI ist damit zulässig. Ein technisch fast `1:1` übernommener Laufzeit- oder Datenvertrag ist ausdrücklich nicht zulässig.

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

Unter `settings` muss der Change mindestens die instanzbezogene Pflege der Waste-Datenquelle ermöglichen:

- Pflegen der Verbindungsdaten für genau eine Waste-Datenquelle der Instanz
- Validieren und nachvollziehbares Rückmelden, ob die konfigurierte Waste-Datenquelle für die Instanz erreichbar ist
- Weiterarbeiten an der Rekonfiguration auch dann, wenn die bisherige Waste-Datenquelle nicht mehr erreichbar ist

Zusätzlich muss der API-/Service-Zuschnitt den aktuellen Primärmodus sauber tragen und spätere Erweiterungen nicht verbauen:

- originäre Studio-Pflege
- spätere Übernahme oder Synchronisation aus einem extern führenden System darf architektonisch möglich bleiben, ist aber nicht Teil dieses Changes

Die Fassade muss außerdem ausreichend fachliche Filter- und Listenabfragen für den Admin-Betrieb unterstützen, insbesondere für:

- Abfallarten
- Adresshierarchien
- Touren und deren Status
- Abweichungs- und Feiertagskontexte

## Risks / Trade-offs

- Instanzisierung des vorhandenen Schemas ist der größte Migrationshebel und kann historische `Newcms`-Daten aufräumen müssen.
- Der Betrieb einer eigenen Waste-Datenbank pro Instanz erhöht den Aufwand für Datenquellenpflege, Erreichbarkeitsprüfung und Migrationsmanagement.
- Eine freie Plugin-Route bietet fachlich mehr Freiheit, verlangt aber mehr Sorgfalt bei Search-Param-, Empty-/Error-State- und Accessibility-Standards.
- Reset in Produktion ist fachlich gewollt, erhöht aber die Anforderungen an Rechtemodell, Audit und explizite Bestätigung im UI.

## Migration Plan

1. Capability und Zielverträge in OpenSpec festziehen.
2. Schema-Zielbild und Migrationspfad für Instanzbezug spezifizieren.
3. Plugin-, Routing-, IAM- und Auditverträge implementieren.
4. Datenzugriff und Fassade hostseitig aufbauen.
5. `Newcms`-MVP fachlich in Studio-UI überführen, ohne Code direkt zu portieren.

## Package Impact and Execution Slices

Die Umsetzung soll nicht als ein einzelner Block erfolgen, sondern in getrennten Package-Slices, damit die Bearbeitung und Review-Grenzen klar bleiben.

### Slice A: Neues Fachplugin und Admin-UI

- `packages/plugin-waste-management`: fachliche Seiten, Dialoge, Tabellen, Formulare, Search-Params, Host-API-Client, Modul-IAM- und Audit-Definitionen
- `packages/plugin-sdk`: falls für freie Fachplugins neue Hilfen für Audit, Settings oder Host-Fetching benötigt werden
- `packages/studio-ui-react`: wiederverwendbare Tabellen-, Dialog-, Confirm- oder Statusbausteine, sofern bestehende UI-Bausteine für Waste-Management nicht ausreichen
- `apps/sva-studio-react`: statische Plugin-Registrierung, Shell-Integration und eventuelle Admin-Einstellungsseiten für instanzbezogene Waste-Konfiguration

### Slice B: Routing und Runtime-Anbindung

- `packages/routing`: freie Plugin-Route `/plugins/waste-management`, Search-Param-Vertrag, Host-Route-Registrierung für `/api/v1/waste-management/*`, Guards und Sichtbarkeitslogik
- `packages/auth-runtime`: Einhängen der Waste-HTTP-Endpunkte in die bestehende Runtime, Auth-, Actor- und Request-Context-Auflösung für Waste-Requests
- `packages/server-runtime`: gemeinsame Runtime-Helfer für Logging, Fehlerabbildung, Request-Kontext, Secret- und Datenquellenauflösung

### Slice C: Zentrale Governance- und Instanzkonfiguration

- `packages/instance-registry`: instanzbezogene technische Modulkonfiguration für die Waste-Datenquelle im zentralen Studio-Postgres, inklusive Read-/Write-Modelle für Admin-Ansichten
- `packages/data-repositories`: primäre Heimat für Persistenz der Waste-Datenquellen-Konfiguration, zentrale Governance-Queries, technische Settings-Validierung und Datenzugriff auf Studio-Postgres sowie für spätere Waste-Fachdatenbank-Repositories
- `packages/data`: nur falls nötig eine dünne Orchestrierungs- oder Kompositionsschicht, aber keine neue primäre Heimat für Waste-SQL
- `packages/core`: gemeinsame Contracts für Waste-Settings, Datenquellenstatus und instanzbezogene Verwaltungsmodelle, falls diese package-übergreifend gebraucht werden

### Slice D: Waste-Host-Fassade, IAM und Audit

- `packages/auth-runtime` oder ein gleichwertiger Host-Runtime-Einstiegspunkt: HTTP-Handler für `/api/v1/waste-management/*`
- `packages/server-runtime`: serverseitige Auflösung der aktiven Waste-Datenquelle, Secret-Nutzung und technische Fehlerverträge
- `packages/data-repositories`: hostseitige Repositories für Waste-Fachdatenbankzugriffe gegen die `waste_*`-Tabellenfamilie
- `packages/iam-admin`: Integration der neuen `waste-management.*` Rechte in Rollen- und Permission-Verwaltung, soweit die bestehenden IAM-Admin-Flows diese zentral pflegen
- `packages/iam-governance`: zentrale Audit-Auswertung, Audit-Read-Modelle oder Governance-Sichten für Waste-Mutationen, sofern diese im Studio sichtbar gemacht werden

### Slice E: Tests, Dokumentation und Architektur

- `apps/sva-studio-react`: E2E- und Integrationspfade für Plugin, Rechte und Einstellungen
- `packages/plugin-waste-management`, `packages/routing`, `packages/auth-runtime`, `packages/data`, `packages/data-repositories`, `packages/instance-registry`: Unit- und Type-Tests entlang der jeweiligen Slice-Verantwortung
- `docs/architecture/*`: Arc42-Fortschreibung für Persistenzgrenzen, Instanzkonfiguration und Runtime-Boundaries

Jeder dieser Slices soll im Change als eigener Task-Abschnitt geführt werden, damit Umsetzung, Review und Tests getrennt geplant und abgenommen werden können.

## Open Questions

- Die konkrete Ausgestaltung eines späteren sekundären Fremdsystem-Modus bleibt offen.
- Konfliktregeln zwischen Synchronisation und manueller Pflege bleiben offen.
- Die genaue Menge URL-stabiler Detail- oder Editorzustände wird implementierungsnah innerhalb des hier gesetzten Routing-Rahmens finalisiert.
