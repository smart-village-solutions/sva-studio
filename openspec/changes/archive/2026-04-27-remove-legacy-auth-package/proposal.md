# Change: Legacy-Package `@sva/auth` sicher entfernen

## Why

Der produktive Runtime-Pfad liegt inzwischen bei `@sva/auth-runtime` und den IAM-Zielpackages. `@sva/auth` ist ein historisches Sammelpackage mit eigener Build-, Test- und Runtime-Oberfläche; solange es im Workspace bleibt, erzeugt es Drift-Risiko, veraltete Targets und falsche Anziehungskraft für neue IAM-Logik.

## What Changes

- Entfernt `packages/auth` als Workspace-Projekt, npm-Package und Nx-Projekt.
- Entfernt `auth` aus Root-Scripts, Nx-Gates, Runtime-Checks, Coverage-/Complexity-Konfiguration, CI-Skripten und sonstiger aktiver Workspace-Konfiguration.
- Verhindert neue produktive Imports aus `@sva/auth`; aktive Consumer müssen `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/iam-core`, `@sva/iam-governance`, `@sva/instance-registry` oder andere Zielpackages nutzen.
- Bereinigt aktive OpenSpec-Specs, nicht-archivierte OpenSpec-Changes sowie Architektur- und Entwicklungsdokumentation so, dass `@sva/auth` nur noch als historischer Archivkontext erscheint.
- Lässt archivierte OpenSpec-Changes, historische Reports und ADRs unangetastet, sofern sie eindeutig historische Entscheidungen dokumentieren.

## Impact

- Affected specs:
  - `monorepo-structure`
  - `iam-server-modularization`
  - `iam-access-control`
  - `architecture-documentation`
- Affected code/config:
  - Root `package.json`
  - `packages/auth/**`
  - Nx-Projektgraph und Workspace-Gates
  - Coverage-/Complexity-/Runtime-Check-Konfiguration inklusive Baselines und tracked Findings
  - CI-Skripte mit Direktimports oder `createRequire` gegen `packages/auth`
  - Test-Fixtures, die `auth` als Beispielpackage verwenden
  - aktive OpenSpec-Specs und nicht-archivierte OpenSpec-Changes
  - aktive Docs unter `docs/`
- Not affected:
  - `@sva/auth-runtime`
  - produktive `/auth/*` Runtime-Routen
  - archivierte OpenSpec-Änderungen und historische Reports
