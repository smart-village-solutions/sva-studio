# Change: Explizite Lifecycle-Phasen für Plugin-Registrierungen definieren

## Why

Build-time-Erweiterungen bleiben langfristig nur dann übersichtlich, wenn klar ist, in welcher Phase ein Package welchen Beitrag registriert. Das Studio braucht dafür einen expliziten Lifecycle für Registrierungen, statt neue Erweiterungspunkte ad hoc einzuführen.

## What Changes

- Einführung definierter Registrierungsphasen für statische Package-Beiträge
- Strukturierung der Plugin-Beiträge entlang von Inhalts-, Admin-, Routing-, Audit- und Suchphasen
- Klärung der Materialisierungsreihenfolge zwischen SDK, Routing und App-Host
- Vermeidung von impliziten oder phasenfremden Plugin-Beiträgen
- Vorbereitung eines besser lesbaren und testbaren Erweiterungsvertrags für neue Packages

## Impact

- Affected specs:
  - `routing`
  - `content-management`
  - `monorepo-structure`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `apps/sva-studio-react`
  - `packages/plugin-example`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
