## Context

Die Plattform besitzt heute einen belastbaren Build-time-Vertrag für interne Plugins, aber noch keinen konsistenten Zielvertrag für:

- lokale Entwicklung neuer Plugins ohne Core-Anpassung
- externe Veröffentlichung als installierbares Artefakt
- kanonische Host-Integration für pluginseitigen Server- und Job-Code
- klare Ownership zwischen Plugin, SDK, Host-Runtime und Distribution

Die aktuelle Zwischenarchitektur begünstigt Drift:

- `@sva/plugin-sdk` trägt bereits domänenspezifische Helfer einzelner Plugins
- der Host registriert Plugins statisch in App-Code
- pluginnahe Runtime-Bestandteile leben app-intern
- einzelne Plugins hängen an hostspezifischen Vertragsquellen statt ihre Beiträge selbst zu besitzen

Wenn diese Richtung fortgeführt wird, wird jede neue Plugin-Fähigkeit künftig ad hoc in `plugin-sdk`, App und Runtime verdrahtet. Das unterläuft das Ziel, Plugins auch extern veröffentlichen und lokal ohne Core-Patches entwickeln zu können.

## Goals / Non-Goals

- Goals:
  - ein einheitlicher Plattformvertrag für interne und externe Plugins
  - lokale Entwicklung ohne Core-Codeänderung
  - publizierbare Plugins mit Manifest und kompatibilitätsgeprüften Artefakten
  - host-owned Ausführungsgrenzen für Routing, IAM, Audit, Jobs und Integrationen
  - saubere Zielrollen der beteiligten Packages
  - klarer Migrationspfad vom statischen Build-time-Modell
- Non-Goals:
  - Sicherheits-Sandboxing für untrusted Fremdcode
  - vollständiger Marketplace
  - vollständige Migration aller bestehenden Plugins in einem einzigen Implementation Slice

## Decisions

### Decision: Duales Plugin-Modell mit einem kanonischen Descriptor

Ein Plugin besitzt genau einen kanonischen Descriptor. Dieser wird in zwei Betriebsformen konsumiert:

1. **Development Source Mode**
   - Workspace-Package oder lokal verlinktes Package
   - Quelle ist der Plugin-Source-Entry
   - gedacht für lokale Entwicklung, Tests und Review

2. **Installed Distribution Mode**
   - Manifest plus gebaute Artefakte
   - Quelle ist eine installierte Paket- oder Artefaktversion
   - gedacht für veröffentlichte Plugins

Der Host arbeitet nicht mit zwei Fachmodellen, sondern materialisiert in beiden Fällen denselben validierten Plugin-Snapshot.

### Decision: Klare Zielrollen der Plattformbausteine

- `@sva/plugin-sdk`
  - öffentliche Authoring-Boundary für Plugin-Entwickler
  - enthält nur generische Typen, deklarative Contribution-Builder, Client-Fassaden und React-nahe Hilfen
  - enthält keine plugin-spezifische Fachlogik einzelner Plugins

- `plugin manifest contract` (neuer Zielbaustein, Name im Implementationschange festzulegen)
  - definiert das serialisierbare Veröffentlichungsformat
  - beschreibt Plugin-Metadaten, Kompatibilität, Entry-Points, optionale Migrations- und Capability-Deklarationen

- `plugin loader/runtime contract` (neuer Zielbaustein, Name im Implementationschange festzulegen)
  - lädt lokale oder installierte Plugin-Deskriptoren
  - validiert Ownership, Kompatibilität und deklarierte Entry-Points
  - erzeugt den kanonischen Host-Snapshot

- Host-Pakete (`routing`, `auth-runtime`, `server-runtime`, App)
  - materialisieren und exekutieren den Snapshot
  - bleiben Owner von Guards, Request-Kontext, Audit, Job-Orchestrierung, Secret- und Instanzauflösung

### Decision: Plugins dürfen Server- und Job-Code mitbringen, aber nur über hostdefinierte Entry-Points

Das Zielbild erlaubt umfassende Plugins. Deshalb dürfen Plugins neben Browser-UI auch mitbringen:

- Server-Handler-Beiträge
- Job-/Worker-Handler
- Import-/Migrationsbeiträge
- Integrationsadapter

Diese Beiträge werden jedoch nicht frei ausgeführt, sondern nur innerhalb hostdefinierter Entry-Points und Kontexte:

- Plugin beschreibt deklarativ, welche Server- oder Job-Beiträge existieren
- Host lädt nur validierte Entry-Points
- Host liefert Ausführungskontext, Security-Kontext, Logger, Job-Context, Instance-Context und Infrastrukturadapter
- Plugin besitzt keine parallele Plattform für Routing, Audit, IAM oder Background-Execution

### Decision: Trusted Plugins, aber host-owned Enforcement

Installierte Plugins gelten als administrativ vertrauenswürdig. Trotzdem bleiben technische Kontrollpunkte host-owned. Das System schützt sich primär vor Architekturdrift, Fehlverdrahtung und versehentlichem Bypass, nicht vor bösartigem Arbitrary-Code-Angriff durch harte Sandbox-Isolation.

Das bedeutet:

- keine vollständige Sandbox-Pflicht
- aber weiterhin fail-closed Validierung an allen Integrationsgrenzen
- keine direkten Plugin-Schreibpfade an Routing, Audit, IAM oder Secret-Auflösung vorbei
- keine impliziten Registrierungen außerhalb des Snapshot-Prozesses

### Decision: Lokale Entwicklung darf keine Host-Codeänderung erfordern

Ein neues Plugin muss lokal eingebunden werden können, ohne App- oder Core-Quellcode zu editieren.

Das Zielbild dafür:

- Dev-Katalog oder deklarative Plugin-Liste außerhalb des Core-Codes
- Host-Loader liest lokale Plugin-Deskriptoren aus konfigurierten Quellen
- Workspace-Plugins und externe lokale Pfade werden identisch validiert
- Entwicklungsmodus und Installationsmodus unterscheiden sich nur in der Quelle, nicht im Host-Vertrag

### Decision: Bestehende statische Build-time-Registry wird nicht verworfen, sondern in den Loader-Snapshot überführt

Die heutige Build-time-Registry ist kein Fehlkonzept, sondern ein unvollständiger Ausschnitt des künftigen Plugin-Loaders. Deshalb wird sie nicht parallel weiter ausgebaut, sondern zum Teil des neuen Snapshot-Vertrags weiterentwickelt.

Ziel:

- Build-time-Registry-Snapshot bleibt kanonische Materialisierungsform
- Snapshot entsteht künftig aus Loader + Manifest + Plugin-Deskriptoren
- App-lokale manuelle Plugin-Listen werden durch Katalog-/Loader-Konfiguration ersetzt

## Target Architecture

### 1. Authoring Layer

Plugin-Entwickler implementieren gegen `@sva/plugin-sdk`:

- `PluginDefinition`
- deklarative Beiträge für Routen, Navigation, Permissions, Admin-Ressourcen, Content-Typen, Audit-Events, Jobtypen, Importprofile
- optionale deklarierte Server-/Job-Entry-Points
- optionale React-Custom-Views über `@sva/studio-ui-react`

### 2. Distribution Layer

Jedes veröffentlichte Plugin liefert:

- Package-Artefakt
- `plugin-manifest.json`
- gebaute Entry-Points für Browser, Server und Jobs
- Kompatibilitätsangaben:
  - unterstützte Host-Major-Versionen
  - erforderliche Plattform-Capabilities
  - optionale Migrations- oder Setup-Schritte

### 3. Catalog / Installation Layer

Der Host führt einen Plugin-Katalog, der mindestens unterscheidet:

- lokal entwickelte Plugins
- installierte Plugins
- aktivierte/deaktivierte Plugins
- Version und Kompatibilitätsstatus

Dieser Katalog ist die einzige Quelle dafür, welche Plugins materialisiert werden.

### 4. Loader / Snapshot Layer

Der Loader:

- liest Katalogeinträge
- lädt Source- oder Distribution-Deskriptoren
- validiert Namespace, Ownership, Kompatibilität und Entry-Point-Form
- materialisiert einen kanonischen Snapshot

Der Snapshot enthält nur validierte, hostkonsumierbare Daten und Entry-Point-Referenzen.

### 5. Host Runtime Layer

Die Host-Runtime konsumiert ausschließlich den Snapshot für:

- Routing-Materialisierung
- Navigation
- IAM-/Guard-Bindings
- Audit-Metadaten
- Job- und Import-Registrierung
- Server-Handler-Bindings

### 6. Execution Context Layer

Wenn Plugin-Server- oder Job-Code ausgeführt wird, erfolgt dies nur über hostdefinierte Kontexte:

- `PluginRequestContext`
- `PluginJobExecutionContext`
- `PluginIntegrationContext`

Diese Kontexte kapseln:

- Instanz- und Request-Kontext
- Logger
- Audit-/Job-Reporter
- erlaubte Host-Adapter
- optionale Feature-Flags und Capability-Zugriffe

## Migration Plan

1. Plattformvertrag als OpenSpec + ADR festziehen
2. `plugin-sdk` auf generische Authoring-Rolle zurückführen
3. Manifest- und Loader-Vertrag einführen
4. statische Host-Plugin-Liste in konfigurierten Katalog überführen
5. Snapshot-Bildung von App-lokaler Verdrahtung entkoppeln
6. Server-/Job-Entry-Points aus app-internen Pfaden in kanonische Plugin-Runtime-Verträge überführen
7. erste Referenzmigration an `plugin-waste-management`
8. Plugin-Guide, Package-Zielarchitektur und arc42 fortschreiben

## Risks / Trade-offs

- Zwei Lieferformen erhöhen zunächst die Komplexität.
  - Mitigation: ein kanonischer Descriptor, ein Snapshot, zwei Quellen

- Bestehende Plugins müssen schrittweise auf neue Katalog- und Loader-Verträge umgestellt werden.
  - Mitigation: Source Mode zuerst unterstützen, Distribution danach ergänzen

- Trusted-Plugin-Modell reduziert die Sicherheitskomplexität, setzt aber Governance und Review voraus.
  - Mitigation: harte Host-Ownership für kritische Plattformgrenzen beibehalten

- Neue Zielbausteine können falsch in bestehende Packages gemischt werden.
  - Mitigation: Package-Zielarchitektur und ADR müssen Zielrollen explizit benennen

## Open Questions

- Welcher konkrete Package-Zuschnitt für Manifest/Loader/Runtime ist am kleinsten und zugleich stabil?
- Ob Plugin-Katalog-Konfiguration in Datei, Datenbank oder beidem geführt wird, wird als Implementationsdetail im Folgechange entschieden.
- Ob veröffentlichte Plugins ausschließlich über npm oder zusätzlich über andere Artefaktquellen installiert werden, wird im Ausführungschange konkretisiert.
