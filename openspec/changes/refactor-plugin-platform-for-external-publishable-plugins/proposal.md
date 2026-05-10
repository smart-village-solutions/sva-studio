# Change: Plugin-Plattform für extern publizierbare und lokal entkoppelt entwickelbare Plugins refaktorieren

## Why

Die aktuelle Plugin-Architektur des Studios liefert bereits einen brauchbaren Build-time-Vertrag für interne Workspace-Plugins, ist aber noch nicht als nachhaltige externe Plugin-Plattform geeignet. Zentrale Grenzen sind heute noch zu stark auf den Host-Bundle-Fall zugeschnitten: statische Host-Registrierung, plugin-spezifische Helfer im generischen SDK, hostspezifische Modul-IAM-Abhängigkeiten im Plugin und app-interne Runtime-Verdrahtung für Plugin-Jobs.

Für das Zielbild des Studios reicht es nicht, weitere Fachplugins entlang dieser Zwischenarchitektur zu ergänzen. Externe Entwickler sollen Plugins erstellen, lokal entwickeln, paketieren, veröffentlichen, installieren und aktualisieren können, ohne dafür Core-Pakete oder App-Quellcode anpassen zu müssen. Dafür braucht das System einen klaren Plattformvertrag mit sauberer Trennung zwischen:

- Authoring-Vertrag für Plugin-Entwickler
- Distributions- und Installationsvertrag für veröffentlichte Plugins
- Host-seitig erzwungenen Runtime-Grenzen für Routing, IAM, Audit, Jobs und Integrationen
- lokalem Dev-Workflow im Workspace und externem Publish-/Installationspfad über denselben kanonischen Plugin-Descriptor

## What Changes

- Führt eine neue Capability `plugin-platform` als normative Spezifikation für Authoring-, Distribution-, Installations- und Runtime-Verträge ein
- Definiert das Zielbild als `Dual Model`:
  - lokale Entwicklung über Workspace- oder verlinkte Source-Packages
  - externe Veröffentlichung und Installation über Plugin-Manifest plus gebaute Artefakte
- Präzisiert die Rollen der Zielbausteine:
  - `@sva/plugin-sdk` nur für generische Authoring-Verträge und deklarative Beitragstypen
  - neuer Loader-/Runtime-Zuschnitt für Manifest-Auflösung, Snapshot-Bildung und Host-Integration
  - keine plugin-spezifische Fachlogik mehr im generischen SDK
- Legt fest, dass Plugins im Zielbild eigenen Server-, Job- und Integrationscode mitbringen dürfen, aber ausschließlich über hostdefinierte Entry-Points und Ausführungskontexte
- Verankert, dass Routing, Guarding, IAM-Entscheidungen, Audit-Emission, Secret-Auflösung, Instanzauflösung und Job-Orchestrierung host-owned bleiben
- Führt einen normativen Plugin-Manifest-Vertrag für veröffentlichte Plugins ein, inklusive Kompatibilitätsangaben, Entry-Points und deklarierter Capabilities
- Definiert einen Plugin-Katalog-/Installationsvertrag, sodass der Host installierte Plugins aktivieren, deaktivieren, validieren und in einen kanonischen Snapshot materialisieren kann
- Definiert einen lokalen Dev-Vertrag, bei dem Plugins ohne Core-Änderung über denselben Descriptor in den Host eingebunden werden können
- Beschreibt einen Migrationspfad von der heutigen statischen Build-time-Registrierung zu einer Plattform mit lokalem Development-Load und installierter Distribution
- Stellt klar, dass `trusted plugin` nicht bedeutet, dass Plugins Host-Ownership für Routing, IAM, Audit oder Persistenz übernehmen dürfen
- Benennt erforderliche Fortschreibungen an ADR-034 oder eine neue ADR für Plugin-Plattform v2

## Non-Goals

- Kein Sandbox- oder Zero-Trust-Ausführungsmodell für fremden, untrusted Drittcode
- Kein Marketplace- oder Billing-System für Plugins in diesem Change
- Keine browserseitige Remote-Code-Ausführung ohne Host-Installationsschritt
- Kein vollständiger Umbau jedes bestehenden Plugins in diesem Change
- Keine vollständige Implementierung der Distributions-Toolchain in einem Schritt; der Change definiert den Zielvertrag und den umsetzbaren Migrationspfad

## Impact

- Affected specs:
  - `plugin-platform` (neu)
  - `routing`
  - `iam-access-control`
  - `iam-auditing`
  - `architecture-documentation`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/routing`
  - `packages/auth-runtime`
  - `packages/server-runtime`
  - `packages/core`
  - `apps/sva-studio-react`
  - neue Zielbausteine für Manifest-/Loader-/Runtime-Verträge
  - bestehende Plugins `packages/plugin-*`
- Affected documentation:
  - `docs/guides/plugin-development.md`
  - `docs/architecture/package-zielarchitektur.md`
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
