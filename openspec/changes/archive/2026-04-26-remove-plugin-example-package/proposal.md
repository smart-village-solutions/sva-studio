# Change: Beispiel-Plugin aus Workspace und Host entfernen

## Why

Das Paket `@sva/plugin-example` ist nur noch ein historisches Referenzartefakt und wird fachlich nicht mehr benoetigt. Solange es im Workspace, in der Host-App und in der Dokumentation weitergefuehrt wird, erzeugt es vermeidbare Pflegekosten, verwischt die produktive Plugin-Landschaft und erschwert klare Aussagen darueber, welche Plugins im Studio tatsaechlich getragen werden.

## What Changes

- Entfernung des Workspace-Packages `packages/plugin-example`
- Entfernung aller Host-, Build- und Test-Referenzen auf `@sva/plugin-example`
- Bereinigung der Monorepo- und Architektur-Dokumentation, die das Beispiel-Plugin noch als aktiven Bestandteil beschreibt
- Klarstellung, dass produktive Plugin-Integration nicht vom Vorhandensein eines Beispiel-Plugins abhaengt

## Impact

- Affected specs:
  - `monorepo-structure`
  - `routing`
  - `architecture-documentation`
- Affected code:
  - `packages/plugin-example`
  - `apps/sva-studio-react`
  - Workspace-Konfigurationen und Dokumentation mit Referenzen auf `@sva/plugin-example`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
