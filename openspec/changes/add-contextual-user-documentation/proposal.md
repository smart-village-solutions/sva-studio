# Change: Kontextbezogene Anwenderdokumentation ergänzen

## Why

Das SVA Studio besitzt derzeit keine vollständige, aus den produktiven Seiten ableitbare Anwenderdokumentation. Neue Seiten können entstehen, ohne dass eine zugehörige Hilfeseite sichtbar wird, und die vorhandene Hilfe-Route stellt noch keinen kontextbezogenen Einstieg bereit.

Die Anwenderdokumentation soll redaktionell und technisch unabhängig vom Studio-Release gepflegt werden können. Gleichzeitig braucht das Studio einen typsicheren Vertrag, der alle regulären Seiten erfasst und den passenden Markdown-Inhalt direkt auf der aktuellen Seite zugänglich macht.

## What Changes

- Die kanonische Route-Registry erhält für jede reguläre, anwenderseitig sichtbare Seite entweder eine stabile Dokumentations-ID oder einen expliziten Ausschlussgrund.
- Statische UI-Routen, aus Admin-Ressourcen materialisierte Routen und freie Plugin-Routen werden in denselben Dokumentationsvertrag aufgenommen.
- Ein deterministisch erzeugter Seitenkatalog stellt die initiale und künftig erweiterbare Liste der benötigten Anwenderdokumentationsseiten bereit.
- Ein Push des geänderten Seitenkatalogs auf `sva-studio/main` stößt unmittelbar einen additiven Sync im Hilfe-Repository an; fehlende Seiten werden als automatisch erzeugter Dokumentations-PR vorgeschlagen.
- Ein separates Repository hält die Markdown-Inhalte, veröffentlicht eine eigenständige statische GitHub-Pages-Website und erzeugt ein maschinenlesbares Manifest für das Studio.
- Das Studio lädt ausschließlich den aktuellen Hilfeinhalt zur Laufzeit über eine hostseitige, auf die konfigurierte Dokumentationsquelle begrenzte Fassade. Änderungen am Hilfe-Repository erfordern keinen neuen Studio-Build.
- Die gemeinsame Studio-Shell zeigt auf jeder dokumentierbaren Seite einen Hilfehinweis und öffnet den zugehörigen Markdown-Inhalt in einem barrierefreien Overlay.
- Die Synchronisation des Hilfe-Repositories legt ausschließlich fehlende Seiten an. Es wird keine automatische Löschung verwaister Markdown-Dateien eingeführt.

## Non-Goals

- Keine Versionierung der Anwenderdokumentation nach Studio-Releases; produktiv ist ausschließlich der aktuelle Stand relevant.
- Keine eigene Hilfeseite für Hilfe-, Support- oder Lizenzseiten sowie für technische Auth-, Debug-, Redirect-, Fehler- oder Not-found-Routen.
- Keine eigenständige Hilfeseite für Dialoge, Tabs, Search-Param-Varianten oder einzelne Datensatz-IDs, solange sie keine eigene produktive Route bilden.
- Kein CMS, keine Datenbank und keine neue Persistenzschicht für Anwenderdokumentation im Studio.
- Keine automatische Entfernung oder Archivierung von Hilfeseiten, wenn eine Studio-Route entfällt.
- Keine direkte Ausführung von HTML, Skripten oder sonstigem aktivem Inhalt aus externem Markdown.

## Impact

- Affected specs:
  - `contextual-user-documentation` (neu)
  - `routing`
  - `plugin-platform`
  - `ui-layout-shell`
- Affected code:
  - `packages/routing`
  - `packages/plugin-sdk`
  - `apps/sva-studio-react` einschließlich Root-/App-Shell, Server-Fassade, Konfiguration, i18n und Tests
  - Skript- und CI-Pfade für den generierten Seitenkatalog
- External delivery:
  - `smart-village-solutions/sva-studio-user-documentation` für Markdown-Inhalte, ereignisgetriebene additive Seitensynchronisation, Manifest und GitHub-Pages-Deployment
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`: Route-owned Dokumentationsvertrag und unabhängige Dokumentationsauslieferung
  - `docs/architecture/05-building-block-view.md`: Seitenkatalog, Hilfe-Fassade und Shell-Overlay
  - `docs/architecture/06-runtime-view.md`: Auflösung und Laden kontextbezogener Hilfe
  - `docs/architecture/07-deployment-view.md`: separates GitHub-Pages-Artefakt und Laufzeitabhängigkeit
  - `docs/architecture/08-cross-cutting-concepts.md`: Sicherheit, Barrierefreiheit, Fehlerbehandlung und Caching

## Related Active Changes

- `refactor-cross-cutting-runtime-guardrails` plant bereits einen deklarativen, typisierten Plugin-Route-Vertrag. Dieser Change ergänzt dessen Route-Metadaten additiv um den Dokumentationsvertrag und DARF keine konkurrierende Plugin-Route-API, Component-Binding-Schicht oder zweite Materialisierungslogik einführen.
- `refactor-sva-studio-react-package-boundaries` hält Shell-Komposition, Routing-Bindings und host-spezifische Route-Assemblierung bewusst im App-Layer. Der Hilfehinweis, das Overlay und der framework-spezifische Server-Einstieg folgen dieser Ownership; generische Metadaten- und Kataloglogik bleiben in den bestehenden Packages.

## Approval Boundary

Dieser Change beschreibt zunächst ausschließlich den freizugebenden Zielvertrag. Die Implementierung im Studio, die Erstellung beziehungsweise Änderung des separaten Hilfe-Repositories, Veröffentlichung, PR, Merge und Rollout bleiben getrennte Arbeitsschritte und Freigabegrenzen.
