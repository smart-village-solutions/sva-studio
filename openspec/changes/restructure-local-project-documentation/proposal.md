# Change: Lokale Projektdokumentation neu strukturieren

## Why

Die lokale Studio-Dokumentation vermischt aktuelle Architektur-, Entwicklungs- und Betriebsanleitungen mit generierten Changelog-Daten, zeitgebundener Evidenz, PR-/Staging-Unterlagen, historischen Plänen und dem Übergabevertrag zur externen Anwenderdokumentation. Dadurch wirken alle Dateien gleichrangig, obwohl sie unterschiedliche Autorität, Zielgruppen und Pflegezyklen besitzen. Der Wiki-Sync verstärkt dieses Problem, weil er den gesamten `docs/`-Baum veröffentlicht und in seiner Navigation teilweise auf Legacy-Quellen verweist.

Am Ausgangsstand `641a9a2f2` liegen 832 versionierte Dateien unter `docs/`; allein `docs/changelog/`, `docs/superpowers/`, `docs/reports/`, `docs/staging/`, `docs/pr/` und `docs/user-documentation/` enthalten zusammen 624 Dateien. Gleichzeitig fehlen Bereichsindizes für zentrale aktuelle Bestände, der zentrale Einstieg enthält veraltete manuelle Workspace-Angaben und allgemeine Link- sowie Indexkonsistenz werden nicht automatisiert geprüft.

## What Changes

- trennt die publizierte aktuelle Wissensbasis von generierten, historischen, evidenzbezogenen und extern angebundenen Dokumentationsartefakten
- richtet `docs/README.md`, die Bereichsindizes und den Wiki-Einstieg als eine konsistente, klickbare Navigation aus
- führt eine zweckbezogene Zielstruktur für Architektur, Entscheidungen, Entwicklung, Betrieb, Referenz und Governance ein
- etabliert bereichsbezogene Ownership und ereignisbasierte Pflege-Trigger ohne flächendeckende Frontmatter-Pflicht
- ergänzt einen blockierenden `check:docs`-Pfad für interne Links, Erreichbarkeit, ADR-Indexparität und Wiki-Publikationsgrenzen
- migriert aktuelle Inhalte kontrolliert aus dem unscharfen Bereich `docs/guides/` und aus losen Root-Dateien, ohne historische Artefakte massenhaft umzuschreiben; der kanonische Rollout-Leitfaden bleibt als stabiler Kompatibilitätsanker an seinem verbindlichen Pfad
- liefert die Umsetzung in genau vier sequenziellen PRs mit jeweils eigenem Scope, Nachweis und Rollback-Grenze

## Impact

- Affected specs: `architecture-documentation`
- Affected documentation: `docs/README.md`, Bereichsindizes und ausgewählte aktuelle Dateien unter `docs/`
- Affected tooling: `.github/workflows/wiki-sync.yml`, `.github/workflows/repository-hygiene.yml`, `package.json`, neue fokussierte Doku-Prüfung unter `scripts/ci/`
- Affected repository guidance: `AGENTS.md`, `DEVELOPMENT_RULES.md` und gegebenenfalls `CONTRIBUTING.md`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md` für die Dokumentationsstrategie
  - `docs/architecture/08-cross-cutting-concepts.md` für Pflege-, Publikations- und Validierungsregeln
  - `docs/architecture/11-risks-and-technical-debt.md` für verbleibende historische Bestände und Migrationsrisiken
- Unaffected product scope: Studio-Runtime, APIs, Datenbanken, Berechtigungen und die Inhalte der externen Anwenderdokumentation

## Delivery Boundary

Der Change konzipiert und spezifiziert vier Folge-PRs, setzt sie aber nicht vor der Freigabe dieses Proposals um. Jeder Folge-PR basiert nach Merge seines Vorgängers auf dem dann aktuellen `origin/main`; die vier PRs werden nicht als unübersichtlicher Parallel- oder Stack-Block gleichzeitig eröffnet.
