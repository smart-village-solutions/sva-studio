# Change: Build-time-Plugin-Registry als kanonischen Host-Vertrag schärfen

## Why

Die aktuelle Plugin-Einbindung des Studios geht bereits in Richtung statischer Host-Registrierung, ist aber noch nicht als belastbarer Build-time-Vertrag für alle Admin- und CMS-Erweiterungen ausdefiniert. Für den weiteren Ausbau des Studios als package-basiertes CMS braucht es eine einzige kanonische Registry, aus der der Host Routen, Navigation, Content-Typen, Guards und i18n deterministisch materialisiert.

## What Changes

- Konsolidierung der bestehenden Plugin-Einbindung auf einen expliziten Build-time-Registry-Vertrag
- Definition eines stabilen Host-Modells für statische Package-Beiträge ohne Runtime-Loading
- Klärung, welche Plugin-Beiträge der Host build-seitig materialisiert und welche explizit ausgeschlossen bleiben
- Vereinheitlichung der Registrierungsbegriffe für Navigation, Admin-Ressourcen, Content-Typen, Guards und Übersetzungen
- Dokumentation der Materialisierungspfade zwischen `packages/sdk`, `packages/routing` und `apps/sva-studio-react`

## Impact

- Affected specs:
  - `monorepo-structure`
  - `routing`
  - `content-management`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `apps/sva-studio-react`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
