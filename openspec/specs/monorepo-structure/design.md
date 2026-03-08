# Design: Monorepo-Tooling (Nx)

## Kontext
SVA Studio ist als modulare Plattform geplant (Core + Packages + Plugins). Das Repo ist ein Nx Integrated Monorepo mit pnpm.

Dieses Dokument beschreibt die Begründung der Tool-Entscheidung und die Konsequenzen für die Zusammenarbeit.

## Entscheidung
Wir verwenden **Nx** als Monorepo-Plattform (statt Turborepo), weil es neben Task-Running/Caching zusätzlich einen Projektgraphen, Generatoren, Developer-Tools und Mechanismen zur Architektur-Governance „out of the box“ mitbringt – und damit auch bei wachsender Repo-Größe (Packages/Plugins) ein konsistentes Set an Workflows für lokale Entwicklung und CI/CD bietet.

## Entscheidungsgründe
### Projektgraph & „affected“ Workflows
- Nx erstellt einen **Projektgraphen** und leitet Abhängigkeiten zwischen Apps und Packages ab.
- Daraus folgen **affected**-Workflows: In CI/CD können Builds/Tests/Lints auf die *tatsächlich betroffenen* Projekte begrenzt werden.
- Das passt besonders gut zu einem Repo, das viele Packages und später viele Plugins enthalten wird.

### Generatoren, DX & Standards
- Nx bietet Generatoren/Plugins für typische Setups (z. B. React/Vite, Libraries, Konfig-Skeletons) und unterstützt damit konsistentes Scaffolding.
- Das reduziert Einrichtungsaufwand und hält Konventionen über Zeit konsistent (weniger Copy/Paste, weniger Drift).
- Für den Alltag ist die Tooling-Story relevant: Workspace-Visualisierung (z. B. via `nx graph`) und IDE-Integration (Nx Console) unterstützen beim Navigieren im Projektgraphen, beim Ausführen von Targets und beim Generieren von Code.

### Architektur-Governance (Core vs. Plugins)
- In einem Plugin-orientierten System ist es wichtig, Abhängigkeiten bewusst zu steuern (z. B. dass Core nicht versehentlich auf Plugin-Code zugreift).
- Nx unterstützt solche Leitplanken (z. B. per Tags/Boundaries und projektbezogenen Regeln), was langfristig Wartbarkeit erhöht.

### Caching, CI & Skalierung
- Nx bringt Task-Caching mit; Remote-Caching kann bei Bedarf zentralisiert werden (z. B. via Nx Cloud oder self-hosted Remote Cache).
- Nx betont dabei „smarter computation caching“ (u. a. zuverlässige File-Restoration für Watcher) und veröffentlicht Benchmarks; für uns ist vor allem wichtig, dass Caching/Invalidierung robust und nachvollziehbar bleibt, wenn das Repo wächst.
- Für CI/CD ist nicht nur Caching relevant, sondern auch **Distributed Task Execution**: Tasks können (optional) intelligent über mehrere Maschinen verteilt werden, inkl. automatischer Artefakt-Verteilung.
- Für E2E-lastige Pipelines gibt es (optional) Mechanismen wie paralleles Aufteilen einzelner E2E-Läufe und automatisches Erkennen/Neu-Ausführen flakiger Tasks.
- Für spätere Releases kann Nx (optional) auch Versionierung/Changelog/Publishing unterstützen (Nx Release).

## Warum nicht Turborepo?
Turborepo ist stark als schneller Task-Runner mit Caching und passt gut, wenn man möglichst wenig „Framework“ um das Monorepo möchte. Es überlässt aber viele Aspekte (Projektmodell, Generatoren, Governance und fortgeschrittene CI-Orchestrierung) bewusst dem Team.

Für SVA Studio ist der Haupttreiber, dass wir **strukturelle Leitplanken und Code-Generation** früh etabliert haben möchten, weil das Repo in Richtung „viele Packages + viele Plugins“ wachsen soll.

## Konsequenzen / Trade-offs
- **Mehr Konzepte:** Nx bringt zusätzliche Begriffe und Konfiguration mit (z. B. project.json, Graph, Targets). Das ist eine Lernkurve.
- **„Nx-way“:** Manche Workflows funktionieren am besten, wenn man Nx-Konventionen akzeptiert.
- **Payoff:** Dafür bekommen wir schnellere CI/CD-Zyklen (affected), konsistentere Scaffolds und stärkere Governance.

## Praktische Leitlinien
- Neue Packages folgen den Konventionen in docs/monorepo.md.
- Targets sollten als Nx Targets definiert werden (statt ad-hoc npm scripts), damit affected/caching zuverlässig greifen.
- Architektur-Grenzen (Core vs. Plugins) werden perspektivisch über Nx-Projektmetadaten (Tags) abgesichert.
- Für Orientierung/Debugging im Workspace sind `nx graph` und Nx Console die bevorzugten Einstiege.
