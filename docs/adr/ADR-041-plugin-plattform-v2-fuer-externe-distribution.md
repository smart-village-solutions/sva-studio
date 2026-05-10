# ADR-041: Plugin-Plattform v2 für externe Distribution und host-owned Runtime

**Status:** Akzeptiert
**Entscheidungsdatum:** 2026-05-10
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** n/a
**GitHub PR:** n/a

## Kontext

Mit ADR-034 wurde ein bewusst statischer Plugin-SDK-Vertrag v1 eingeführt. Dieser Schritt war richtig, um interne Workspace-Plugins über `PluginDefinition`, Build-time-Registrierung und host-owned Route-Materialisierung zu vereinheitlichen. Der Vertrag war aber explizit nicht als vollständige externe Plugin-Plattform gedacht.

Inzwischen reichen die Grenzen von v1 für das Zielbild des Studios nicht mehr aus:

1. Plugins werden weiterhin statisch im App-Bundle importiert und registriert.
2. `@sva/plugin-sdk` trägt neben generischen Verträgen weiterhin fachnahe Helper, die nicht Teil eines generischen Plattformkerns sein sollten.
3. Es gibt noch keinen serialisierbaren Manifest-Vertrag für veröffentlichte Plugins.
4. Es gibt noch keinen kanonischen Katalog- und Loader-Vertrag, der lokale Development-Plugins und installierte Distributions-Plugins auf denselben Host-Snapshot materialisiert.
5. Server-, Job- und Integrationsbeiträge benötigen im Zielbild host-owned Execution-Contexts, damit Routing, IAM, Audit, Secret-Auflösung, Fehlervertrag und Job-Orchestrierung nicht in Plugin-Code diffundieren.

Gleichzeitig soll Studio kein Zero-Trust- oder Sandbox-Modell für untrusted Drittcode einführen. Ziel ist eine belastbare Plattform für trusted Plugins mit sauberer Host-Ownership, reproduzierbarer Distribution und klarer Betriebsführung.

## Entscheidung

- ADR-034 bleibt als dokumentierter Zwischenstand für den statischen Plugin-SDK-Vertrag v1 gültig.
- Für das Zielbild wird eine nachgelagerte Plugin-Plattform v2 eingeführt, die ADR-034 ergänzt und in Teilen supersediert.
- Die Plugin-Plattform v2 trennt vier Vertragsflächen:
  - Authoring-Vertrag für Plugin-Entwickler
  - Manifest-Vertrag für veröffentlichte Plugins
  - Katalog- und Loader-Vertrag für lokale und installierte Plugins
  - host-owned Runtime-Vertrag für Routing, IAM, Audit, Jobs, Server- und Integrationsbeiträge
- Der Host materialisiert Plugins ausschließlich über einen validierten kanonischen Plugin-Snapshot. Routing, Navigation, Guards, Audit, Job-Registrierung und weitere Runtime-Consumer lesen keine rohen Plugin-Deskriptoren direkt.
- Lokale Entwicklung und externe Distribution verwenden denselben kanonischen Descriptor-Pfad. Die Quelle darf technisch unterschiedlich sein, der Host-Vertrag nicht.
- `@sva/plugin-sdk` bleibt die öffentliche Boundary für generische Plugin-Authoring-Verträge, deklarative Contribution-Builder, hostkontrollierte Client-Fassaden und pluginseitige React-Hilfen.
- Manifest-, Katalog-, Loader- und Runtime-Bausteine werden als eigene Zielrollen neben `@sva/plugin-sdk` beschrieben und dürfen nicht in App-Lokalcode oder fachspezifischen Plugins versteckt bleiben.
- Host-owned Execution-Contexts bleiben verpflichtend für pluginseitige Request-, Job- und Integrationsbeiträge. Plugins liefern fachliche Handler, übernehmen aber keine Host-Ownership für Authentifizierung, Instanzauflösung, Guard-Entscheidung, Audit-Emission, Secret-Auflösung oder Fehlervertrag.

## Begründung

### Positive Konsequenzen

- Der bisherige v1-Vertrag bleibt historisch und technisch nachvollziehbar, statt durch eine Totalumschreibung unklar zu werden.
- Studio erhält ein belastbares Zielbild für externe Plugin-Distribution, ohne den bestehenden Workspace-Vertrag künstlich zu überdehnen.
- Lokaler Dev-Load und installierte Distribution werden über denselben Snapshot-Vertrag vereinheitlicht.
- Host-Ownership für Routing, IAM, Audit, Jobs und Secrets bleibt auch bei erweiterten Plugin-Fähigkeiten klar erkennbar und überprüfbar.
- Die Plattform wird für Migration, Governance, Review und Betriebsdiagnostik besser zerlegbar.

### Negative Konsequenzen

- Die Architektur erhält zusätzliche Zielbausteine und damit mehr Dokumentations- und Implementierungsaufwand.
- Die Übergangsphase zwischen v1 und v2 muss explizit dokumentiert und in Reviews gegen Drift abgesichert werden.
- Bestehende Plugins und App-Wiring-Pfade müssen schrittweise auf Katalog-, Loader- und Snapshot-Verträge migriert werden.

## Verworfene Alternativen

### 1. ADR-034 direkt überschreiben

Verworfen, weil damit der bewusst statische v1-Trade-off unscharf würde. Für die Architekturpflege ist es wertvoller, v1 als gültigen Zwischenstand stehen zu lassen und v2 als nachgelagerte Zielentscheidung zu dokumentieren.

### 2. Bei statischer App-Registrierung bleiben

Verworfen, weil externe Distribution, lokale entkoppelte Plugin-Entwicklung und deterministische Aktivierung/Deaktivierung damit nicht sauber erreicht werden können.

### 3. Manifest, Katalog und Loader im Plugin-SDK verstecken

Verworfen, weil dies die öffentliche Boundary überlädt und Host-Ownership mit Authoring-API vermischt. Der Plattformkern braucht getrennte Zielrollen.

## Konsequenzen für Umsetzung und Betrieb

- Architektur- und OpenSpec-Dokumentation müssen künftig zwischen Plugin-SDK v1 und Plugin-Plattform v2 unterscheiden.
- `docs/architecture/package-zielarchitektur.md` beschreibt neben `@sva/plugin-sdk` die Zielrollen für Manifest, Katalog, Loader und Runtime.
- App-lokale Plugin-Arrays und statische Importlisten gelten nur noch als Übergangspfad, nicht als Zielbild.
- Veröffentlichte Plugins benötigen einen serialisierbaren Manifest-Vertrag mit Identität, Version, Host-Kompatibilität, Capabilities und Entry-Points.
- Der Plugin-Katalog bleibt die führende Quelle für Aktivierung, Deaktivierung und Kompatibilitätsstatus.
- Runtime-Consumer wie Routing, IAM, Audit und Job-Orchestrierung lesen denselben validierten Snapshot und bauen keine parallelen Teilregistries auf.

## Verhältnis zu ADR-034

- ADR-034 definiert den statischen Plugin-SDK-Vertrag v1.
- ADR-041 erweitert das Zielbild von v1 zu einer Plattform v2 mit Distribution, Katalog, Loader und host-owned Runtime.
- ADR-034 bleibt für bestehende v1-Consumer und den dokumentierten Migrationsstart gültig.
- Wo ADR-034 noch statische App-Registrierung als akzeptierten Trade-off beschreibt, ist ADR-041 für das Zielbild maßgeblich.

## Verwandte ADRs

- [ADR-034](ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-037](ADR-037-plugin-spezifische-iam-rechte.md)
- [ADR-038](ADR-038-instanz-modul-zuordnung-und-fail-closed-modulaktivierung.md)
- [ADR-040](ADR-040-graphile-workflows-als-standard-fuer-hintergrundprozesse.md)
