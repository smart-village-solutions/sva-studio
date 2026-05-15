# Change: `@sva/sdk` vollstaendig entfernen

## Why

Der vorherige Hard-Cut hat `@sva/sdk` bereits auf einen dokumentierten Compatibility-Layer reduziert. Aktive produktive Consumer ausserhalb von `packages/sdk` gibt es nicht mehr, trotzdem erzeugen das Paket selbst, seine Testziele und mehrere aktive Metadatenquellen weiter den Eindruck eines gueltigen Zielpackages.

Der naechste logische Schritt ist deshalb ein bewusster Breaking Cut: `@sva/sdk` wird komplett aus dem Workspace entfernt. Dadurch wird die Zielarchitektur technisch erzwungen statt nur dokumentiert, und die verbleibenden Boundary- und Governance-Quellen koennen ohne Altpfad-Ausnahmen konsolidiert werden.

## What Changes

- entfernt das Workspace-Paket `@sva/sdk` inklusive aller Exporte, Targets, Tests und Metadaten
- verteilt die bisherigen SDK-Tests auf `@sva/plugin-sdk`, `@sva/server-runtime` und ein dediziertes internes Tooling-Testprojekt
- stellt aktive Skripte, Governance-Quellen und Architektur-/Entwicklerdoku auf die kanonischen Zielpackages um
- ersetzt den bisherigen Compat-Inventar-Report durch eine Abschlussdokumentation fuer die Entfernung
- dokumentiert den Breaking-Migrationspfad `@sva/sdk` -> `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core`, `@sva/monitoring-client/logging`

## Out of Scope

- keine Bereinigung historischer Alt-Dokumente unter `docs/staging/`, `docs/pr/` oder archivierten OpenSpec-Changes
- keine neue Sammelfassade oder Shim-Library als Ersatz fuer `@sva/sdk`
- keine Rueckverlagerung von Verantwortungen zwischen `plugin-sdk`, `server-runtime`, `core` und `monitoring-client`

## Impact

- Affected specs:
  - `monorepo-structure`
  - `architecture-documentation`
- Affected code:
  - `packages/sdk/*` (Entfernung)
  - `packages/plugin-sdk/*`
  - `packages/server-runtime/*`
  - `packages/core/*`
  - `packages/monitoring-client/*`
  - `scripts/ops/*`
  - `tooling/testing/*`
  - `package.json`
  - `apps/sva-studio-react/builder.workspace.json`
- Affected arc42 sections:
  - `docs/architecture/01-introduction-and-goals.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
  - `docs/architecture/12-glossary.md`
  - `docs/architecture/logging-architecture.md`
  - `docs/architecture/package-zielarchitektur.md`

## Success Criteria

- `packages/sdk` existiert nicht mehr im aktiven Workspace
- kein aktiver App-, Package-, Skript-, Nx-, Coverage- oder Governance-Pfad referenziert `@sva/sdk`, `packages/sdk` oder `sdk:*`
- ehemals SDK-gebundene Tests laufen in ihren neuen Zielprojekten gruen
- aktive Architektur- und Entwicklerdokumentation beschreibt nur noch die Zielpackages und den Breaking-Migrationspfad
