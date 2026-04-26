# Change: Explizite Lifecycle-Phasen für Plugin-Registrierungen definieren

## Why

Build-time-Erweiterungen bleiben langfristig nur dann übersichtlich, wenn klar ist, in welcher Phase ein Package welchen Beitrag registriert. Das Studio braucht dafür einen expliziten Lifecycle für Registrierungen, statt neue Erweiterungspunkte ad hoc einzuführen.

## What Changes

- Einführung definierter Registrierungsphasen für statische Package-Beiträge
- Strukturierung der Plugin-Beiträge entlang von Inhalts-, Admin-, Routing- und Audit-Phasen
- Klärung der Materialisierungsreihenfolge zwischen `@sva/plugin-sdk`, `@sva/routing` und App-Host
- Aufbau auf den host-erzwungenen Plugin-Guardrails mit denselben deterministischen Fehlercodes
- Vermeidung von impliziten oder phasenfremden Plugin-Beiträgen
- Vorbereitung eines besser lesbaren und testbaren Erweiterungsvertrags für neue Packages

## Impact

- Affected specs:
  - `routing`
  - `content-management`
  - `iam-auditing`
  - `monorepo-structure`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/sdk` (Re-Exports/Adapter)
  - `packages/routing`
  - `apps/sva-studio-react`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
