# plugin-platform Specification

## Purpose

TBD - created by archiving change refactor-plugin-platform-for-external-publishable-plugins. Update Purpose after archive.

## Requirements

### Requirement: Einheitlicher Plugin-Plattformvertrag

Das System SHALL einen kanonischen Plugin-Plattformvertrag für interne und externe Plugins bereitstellen. Dieser Vertrag umfasst Authoring, Distribution, Installation, Snapshot-Materialisierung und Runtime-Execution.

#### Scenario: Interner und externer Plugin-Pfad nutzen denselben Plattformvertrag

- **GIVEN** ein Plugin wird lokal als Workspace-Package entwickelt
- **AND** ein anderes Plugin wird als veröffentlichte Distribution installiert
- **WHEN** der Host beide Plugins lädt
- **THEN** validiert und materialisiert er beide über denselben kanonischen Plattformvertrag
- **AND** Routing, IAM, Audit, Jobs und Navigation konsumieren denselben Snapshot-Typ

### Requirement: Duales Betriebsmodell mit Source- und Distribution-Mode

Das System SHALL Plugins in zwei Betriebsmodi unterstützen: `development source mode` und `installed distribution mode`.

#### Scenario: Lokales Plugin wird ohne Core-Änderung entwickelt

- **GIVEN** ein Entwickler erstellt ein neues Plugin als Workspace-Package oder lokal verlinktes Package
- **WHEN** der Host im lokalen Development-Profil startet
- **THEN** kann das Plugin über einen konfigurierten Katalog eingebunden werden
- **AND** der Entwickler muss dafür keinen Core- oder App-Quellcode editieren

#### Scenario: Veröffentlichtes Plugin wird installiert

- **GIVEN** ein Plugin liegt als veröffentlichte Distribution mit Manifest und gebauten Artefakten vor
- **WHEN** der Host das Plugin installiert oder aktiviert
- **THEN** lädt der Host das Plugin über denselben kanonischen Descriptor
- **AND** die Quelle unterscheidet sich nur technisch vom lokalen Development-Load

### Requirement: Serialisierbarer Plugin-Manifest-Vertrag

Das System SHALL für veröffentlichte Plugins einen serialisierbaren Plugin-Manifest-Vertrag definieren.

Der Manifest-Vertrag MUST mindestens enthalten:

- `pluginId`
- `version`
- Host-Kompatibilitätsangaben
- deklarierte Plattform-Capabilities
- Entry-Points für Browser, Server und optionale Job-/Worker-Beiträge
- optional deklarierte Migrations- oder Setup-Anforderungen
- optional deklarierte Runtime-Anforderungen für hostseitig bereitgestellte Ausführungskontexte

#### Scenario: Manifest beschreibt ein publizierbares Plugin vollständig

- **GIVEN** ein externes Plugin wird paketiert
- **WHEN** der Host nur das Manifest liest
- **THEN** kann er Kompatibilität, Plugin-Identität, verfügbare Entry-Points und benötigte Plattform-Capabilities prüfen
- **AND** er muss dafür keinen unvalidierten Plugin-Code vorzeitig ausführen

#### Scenario: Job-Entry-Point deklariert eine Host-Runtime-Anforderung

- **GIVEN** ein Plugin veröffentlicht einen `jobs`-Entry-Point
- **WHEN** der Host das Manifest validiert
- **THEN** enthält das Manifest eine deklarative Job-Runtime-Anforderung
- **AND** der Host kann daraus den benötigten host-owned Runtime-Contract bestimmen, bevor er Plugin-Code ausführt

### Requirement: Katalog- und Aktivierungsvertrag

Das System SHALL einen kanonischen Plugin-Katalogvertrag bereitstellen, der lokale und installierte Plugins als aktivierbare Host-Bestandteile beschreibt.

#### Scenario: Plugin ist installiert aber deaktiviert

- **GIVEN** ein Plugin ist im Katalog vorhanden, aber deaktiviert
- **WHEN** der Host den Plugin-Snapshot materialisiert
- **THEN** wird dieses Plugin nicht in Routing, Navigation, IAM, Jobs oder Audit registriert
- **AND** der Katalogzustand bleibt die führende Quelle für die Aktivierung

#### Scenario: Inkompatibles Plugin wird fail-closed abgelehnt

- **GIVEN** ein Plugin deklariert eine nicht unterstützte Host-Version oder Capability-Anforderung
- **WHEN** der Host den Katalog lädt
- **THEN** markiert er das Plugin deterministisch als inkompatibel
- **AND** veröffentlicht keinen partiell inkonsistenten Snapshot

### Requirement: Host-owned Snapshot-Materialisierung

Das System SHALL Plugins ausschließlich über einen host-validierten Snapshot materialisieren.

#### Scenario: Host veröffentlicht nur validierte Beiträge

- **GIVEN** ein Plugin beschreibt Routen, Permissions, Audit-Events, Job-Typen und Server-Entry-Points
- **WHEN** der Host den Descriptor validiert
- **THEN** veröffentlicht er nur die validierten Beiträge in einem kanonischen Snapshot
- **AND** App, Routing und Runtime konsumieren keine rohen Plugin-Deskriptoren direkt

### Requirement: Plugin-SDK bleibt generisch

`@sva/plugin-sdk` MUST ausschließlich generische Authoring-Verträge, deklarative Contribution-Builder, Host-Client-Fassaden und pluginseitige React-Hilfen bereitstellen.

#### Scenario: Plugin-SDK enthält keine fachspezifischen Einzelplugin-Helfer

- **GIVEN** ein Fachplugin benötigt plugin-spezifische Jobtypen, Importprofile oder Fachmetadaten
- **WHEN** die Zielarchitektur umgesetzt oder reviewed wird
- **THEN** liegen diese Helfer im Plugin selbst oder in einem explizit fachlichen Package
- **AND** sie werden nicht als generische SDK-Bestandteile veröffentlicht

### Requirement: Plugin-eigene Server- und Job-Beiträge laufen nur in Host-Kontexten

Das System SHALL pluginseitige Server-, Job- und Integrationsbeiträge nur innerhalb hostdefinierter Execution-Contexts ausführen.

#### Scenario: Plugin-Job-Handler läuft im Host-Kontext

- **GIVEN** ein Plugin liefert einen Job-Handler
- **WHEN** der Host den Handler ausführt
- **THEN** stellt er einen host-owned Execution-Context mit Request-/Instance-Kontext, Logger, Audit-Reporter und Job-Reporter bereit
- **AND** der Plugin-Handler erhält keinen parallelen direkten Zugriff auf hostinterne Runner-, Secret- oder Registry-Interna

#### Scenario: Plugin-Request-Handler läuft im Host-Kontext

- **GIVEN** ein Plugin liefert einen serverseitigen Request-Beitrag
- **WHEN** dieser Beitrag über einen hostgestützten Endpoint ausgeführt wird
- **THEN** erfolgt Authentifizierung, Instanzauflösung, Request-Kontext und Fehlervertrag host-owned
- **AND** das Plugin implementiert nur die fachliche Handler-Logik innerhalb dieses Kontexts

#### Scenario: Host löst Plugin-Job-Runtime über Contract-ID statt Plugin-ID auf

- **GIVEN** ein Plugin mit `jobs`-Entry-Point deklariert eine Job-Runtime-Contract-ID im Manifest
- **WHEN** der Host die Job-Handler aus dem kanonischen Plugin-Snapshot registriert
- **THEN** bindet er die Runtime über diese Contract-ID an den Plugin-Job-Entry-Point
- **AND** neue Plugins benötigen dafür keine pluginId-spezifische Host-Matrix

### Requirement: Lokale Entwicklung bleibt Core-entkoppelt

Das System SHALL für lokale Plugin-Entwicklung einen verbindlichen Workflow bereitstellen, der keine Codeänderung in Core- oder App-Paketen benötigt.

#### Scenario: Neues lokales Plugin wird per Konfiguration eingebunden

- **GIVEN** ein Entwickler erzeugt lokal ein neues Plugin
- **WHEN** er das Plugin dem Dev-Katalog hinzufügt
- **THEN** bindet der Host das Plugin über denselben Loader wie installierte Plugins ein
- **AND** es sind keine zusätzlichen `import`- oder Registrierungsänderungen in `apps/sva-studio-react` erforderlich

### Requirement: Published Plugins bleiben kompatibilitätsprüfbar

Das System SHALL für veröffentlichte Plugins eine deterministische Kompatibilitätsprüfung vor Aktivierung bereitstellen.

#### Scenario: Major-Inkompatibilität blockiert Plugin-Aktivierung

- **GIVEN** ein veröffentlichtes Plugin fordert eine inkompatible Host-Major-Version
- **WHEN** ein Operator das Plugin installieren oder aktivieren will
- **THEN** lehnt der Host die Aktivierung mit einer stabilen, nachvollziehbaren Fehlermeldung ab
- **AND** das Plugin wird nicht teilweise geladen

### Requirement: Plugin-Vertrag unterscheidet Standard Path und Advanced Path

The plugin platform SHALL expose a documented Standard Path for typical plugin use cases and a documented Advanced Path for explicitly approved exceptions.

#### Scenario: Typisches Fachplugin nutzt den Standard Path

- **GIVEN** ein Plugin liefert deklarative Beitraege und optional React-Custom-Views
- **WHEN** es nur `@sva/plugin-sdk` und optional `@sva/studio-ui-react` als Workspace-Vertrag nutzt
- **THEN** faellt es unter den Standard Path
- **AND** es benoetigt keine weitergehende Host-Freigabe

#### Scenario: Plugin benoetigt erweiterte Runtime-Faehigkeit

- **GIVEN** ein Plugin benoetigt eine hostseitige Job-, Server- oder Integrationsfaehigkeit
- **WHEN** diese Faehigkeit nicht bereits als oeffentlicher Plugin-Vertrag dokumentiert ist
- **THEN** ist ein eigener OpenSpec-Change oder eine explizite Delta-Erweiterung erforderlich
- **AND** ein interner Importpfad ersetzt diese Freigabe nicht

### Requirement: Plugin-Boundary-Governance blockiert neue Drift

The plugin platform MUST enforce plugin architecture boundaries through a blocking validation that evaluates package dependencies, source imports, and host-signalling file structures.

#### Scenario: Neues Plugin fuehrt verbotene Host-Struktur ein

- **GIVEN** ein Plugin fuehrt einen Dateipfad wie `mainserver-*`, `plugin-catalog-*` oder `route-binding*` ein
- **WHEN** der Plugin-Architecture-Boundary-Check laeuft
- **THEN** blockiert der Check den Lauf als harten Host-Ownership-Verstoss

#### Scenario: Plugin nutzt review-pflichtiges Runtime-Signal

- **GIVEN** ein Plugin enthaelt eine Struktur wie `server.ts`, `plugin-operations.ts` oder `*.controller.ts`
- **WHEN** der Plugin-Architecture-Boundary-Check laeuft
- **THEN** ist diese Struktur nur mit dokumentierter Baseline-Ausnahme oder kuenftigem oeffentlichem Vertrag tolerierbar
- **AND** neue undokumentierte Faelle blockieren den Lauf

### Requirement: Featured Projects besitzen einen eigenständigen Plugin- und IAM-Vertrag

Das System MUST `@sva/plugin-projects` als eigenständiges Plugin mit den Actions `projects.read`, `projects.create`, `projects.update` und `projects.delete` registrieren. Der fachliche Projekte-Pfad darf keine Generic-Items-, FAQ- oder Cockpit-Cards-Actions wiederverwenden. Unabhängig davon MUST der technische Generic-Items-Pfad denselben zugrunde liegenden Mainserver-Datensatz ausschließlich anhand von `generic-items.*` autorisieren dürfen.

#### Scenario: Fachliche Projekte-Berechtigungen werden getrennt ausgewertet

- **WHEN** der Host eine Operation über den fachlichen Projekte-Pfad autorisiert
- **THEN** prüft er die passende Action im Namespace `projects`
- **AND** gewährt eine Generic-Items-, FAQ- oder Cockpit-Cards-Berechtigung allein auf diesem Pfad keinen Zugriff

#### Scenario: Generischer Zugriff auf ein Featured Project

- **GIVEN** ein Mainserver-GenericItem besitzt `genericType` gleich `FeaturedProject`
- **WHEN** der Host eine Operation über den generischen Generic-Items-Pfad autorisiert
- **THEN** prüft er ausschließlich die passende Action im Namespace `generic-items`
- **AND** verlangt keine zusätzliche Action im Namespace `projects`

### Requirement: Das Projekte-Plugin bleibt unabhängig vom Generic-Items-Plugin

Das System MUST das Projekte-Plugin als eigenständiges Workspace-Package betreiben. Eine einmalige Ableitung aus dem Generic-Items-Quellstand darf keine Runtime-Abhängigkeit, Vererbung oder automatische Synchronisierung zwischen den Fachplugins erzeugen.

#### Scenario: Generic-Items-Plugin ändert sich unabhängig

- **WHEN** das Generic-Items-Plugin später geändert wird
- **THEN** verändert sich das Verhalten des Projekte-Plugins nicht automatisch
- **AND** bleiben projektspezifische UI, Validierung und Verträge pluginlokal kontrolliert

### Requirement: Cockpit Cards besitzen einen eigenständigen Plugin- und IAM-Vertrag

Das System MUST `@sva/plugin-cockpit-cards` als eigenständiges Plugin mit den Actions `cockpit-cards.read`, `cockpit-cards.create`, `cockpit-cards.update` und `cockpit-cards.delete` registrieren. Cockpit Cards dürfen nicht die FAQ- oder Generic-Items-Actions wiederverwenden.

#### Scenario: Cockpit-Cards-Berechtigungen werden getrennt ausgewertet

- **WHEN** der Host eine Cockpit-Cards-Operation autorisiert
- **THEN** prüft er die passende Action im Namespace `cockpit-cards`
- **AND** gewährt eine FAQ- oder Generic-Items-Berechtigung allein keinen Zugriff

### Requirement: Fachplugins deklarieren ihre GenericItem-Zuständigkeit eindeutig

Das System MUST einem registrierten Plugin-Content-Type erlauben, genau einen übernommenen Mainserver-`genericType` als exakten Diskriminator zu deklarieren. Die Build-time-Registry MUST leere Diskriminatoren sowie mehrere Content-Types mit demselben Diskriminator ablehnen. Das Generic-Items-Plugin MUST ohne Wildcard-Deklaration als Fallback bestehen bleiben.

#### Scenario: Fachplugin übernimmt einen GenericItem-Typ

- **GIVEN** das Projekte-Plugin registriert `FeaturedProject` für `projects.project`
- **WHEN** die Build-time-Registry aufgebaut wird
- **THEN** enthält ihr unveränderlicher Snapshot diese eindeutige Zuständigkeit
- **AND** kann der Host daraus die zentrale GenericItem-Klassifikation ableiten

#### Scenario: Zwei Plugins beanspruchen denselben Diskriminator

- **GIVEN** zwei registrierte Content-Types deklarieren denselben `genericType`
- **WHEN** die Build-time-Registry validiert wird
- **THEN** schlägt ihr Aufbau mit einem Ownership-Fehler fehl
- **AND** wählt das System keinen Content-Type anhand der Registrierungsreihenfolge aus

#### Scenario: Abweichende Großschreibung bleibt ein anderer Typ

- **GIVEN** ein Fachplugin deklariert `FAQ`
- **WHEN** ein GenericItem den Wert `faq` besitzt
- **THEN** beansprucht das Fachplugin diesen Datensatz nicht
- **AND** bleibt er dem generischen Fallback zugeordnet

#### Scenario: Server baut die Zuordnung ohne Browser-Entrypoint auf

- **GIVEN** ein aktiviertes Fachplugin deklariert seine GenericItem-Zuständigkeit in einem server-sicheren Ownership-Modul
- **WHEN** der Host die Mainserver-Zuordnung materialisiert
- **THEN** verwendet er ausschließlich diese kleine Deklaration
- **AND** lädt weder den Browser-Plugin-Snapshot noch React-Flächen oder Browser-Logger

### Requirement: Plugin-Contributions deklarieren ihre Historienpflicht

Die Plugin-Plattform MUST für jede Contribution deklarativ und hostvalidiert bestimmen, ob sie redaktionell veränderbare Datensätze besitzt und deshalb die host-owned History-Capability benötigt. Historienpflichtige Contributions ohne gültiges Binding MUST vor der Snapshot-Veröffentlichung fail-closed abgelehnt werden.

#### Scenario: Neues Content-Plugin deklariert veränderbare Datensätze

- **WENN** ein neues Plugin einen redaktionell veränderbaren Content-Typ registriert
- **DANN** verlangt der Host eine kompatible host-owned History-Capability
- **UND** prüft das Binding vor Admin- und Route-Materialisierung

#### Scenario: Historienpflichtiges Plugin besitzt kein Binding

- **WENN** ein Plugin veränderbare redaktionelle Datensätze registriert, aber keine gültige History-Capability besitzt
- **DANN** blockiert die Registry-Validierung die Contribution mit einem stabilen Diagnosecode
- **UND** veröffentlicht keinen Editor mit einem Platzhalter-Historienbereich

#### Scenario: Nicht historienpflichtige Contribution wird begründet klassifiziert

- **WENN** eine Contribution keine eigenen redaktionell veränderbaren Datensätze besitzt
- **DANN** darf sie mit einem hostvalidierten Grundcode als nicht historienpflichtig klassifiziert werden
- **UND** diese Klassifikation umgeht keine tatsächlich vorhandene Content-Mutation

### Requirement: Zukünftige Plugin-Templates verankern den History-Vertrag

Das System SHALL Plugin-Authoring-Dokumentation, Templates und vorhandene Generatoren so gestalten, dass neue Content-Plugins den gemeinsamen History-Vertrag standardmäßig verwenden und die zulässigen Ausnahmen explizit machen.

#### Scenario: Neues Content-Plugin wird erzeugt

- **WENN** ein Entwickler ein neues Content-Plugin über einen vorhandenen Template- oder Generatorpfad anlegt
- **DANN** enthält das Ergebnis die deklarative History-Capability, den gemeinsamen Read-Pfad und Contract-Tests
- **UND** keine pluginlokale History-Persistenz

#### Scenario: Plugin wird ohne Generator erstellt

- **WENN** ein manuell erstelltes Plugin in den Katalog aufgenommen wird
- **DANN** prüft dieselbe blockierende Registry- und CI-Validierung den History-Vertrag
- **UND** der manuelle Pfad bietet keine schwächere Ausnahme

### Requirement: FAQ-Plugin verwendet getrennte autorisierbare Actions

Das System MUST die FAQ-Operationen über die fully-qualified Actions `faq.read`, `faq.create`, `faq.update` und `faq.delete` autorisieren. Das FAQ-Plugin MUST seine FAQ-Admin-Ressource und UI-Bindings deklarativ über den bestehenden Standard-Content-Plugin-Vertrag registrieren.

#### Scenario: FAQ-Operation wird autorisiert

- **WHEN** ein Benutzer eine FAQ-Listen-, Create-, Update- oder Delete-Operation ausführt
- **THEN** prüft der Host die zugehörige `faq.*`-Action im Instanz- und Organisationskontext
- **AND** führt die Operation nur bei erfolgreicher Prüfung aus

#### Scenario: Fehlende FAQ-Berechtigung blockiert die Operation

- **WHEN** einem Benutzer die für eine FAQ-Operation benötigte `faq.*`-Action fehlt
- **THEN** veröffentlicht der Host die geschützte Admin-Fläche nicht für diesen Benutzer oder weist die serverseitige Operation ab
- **AND** der Mainserver wird nicht aufgerufen

#### Scenario: FAQ folgt dem Standard-Content-Plugin-Vertrag

- **WHEN** der Host den FAQ-Plugin-Beitrag registriert
- **THEN** veröffentlicht er die FAQ-`list`-, `detail`- und `editor`-Bindings zusammen mit der FAQ-Admin-Ressource
- **AND** blendet er deren direkte Navigation zugunsten der gemeinsamen Inhaltsübersicht aus
