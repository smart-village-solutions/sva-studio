# Spec Delta: monorepo-structure

## MODIFIED Requirements

### Requirement: Build- und Target-Konventionen
Das System SHALL standardisierte Nx Targets für build, lint und Testarten bereitstellen, mit klarer Trennung zwischen Unit-, Coverage- und Integrationstests **und Nx-Caching-Unterstützung**.

#### Scenario: Standardisierte Targets (erweitert)
- **WHEN** ein neues Package oder eine App erstellt wird
- **THEN** sind mindestens `build`, `lint` und ein Testtarget definiert
- **AND** Target-Namen folgen Workspace-Konventionen
- **AND** Test-Targets haben korrekte `cache`, `inputs` und `outputs` in nx.json

#### Scenario: Coverage-Target mit Nx Cache
- **WHEN** `test:coverage` Target in project.json definiert wird
- **THEN** ist Cache in nx.json targetDefaults aktiviert
- **AND** inputs umfassen: default, ^production, {workspaceRoot}/vitest.config.ts
- **AND** outputs umfassen: {projectRoot}/coverage
- **AND** zweiter Coverage-Run nutzt Cache (Cache Hit)

#### Scenario: Zentrale Vitest-Workspace-Konfiguration
- **WHEN** neues Package erstellt wird
- **THEN** referenziert es zentrale vitest.workspace.ts im Root
- **AND** Package-spezifische vitest.config.ts enthält nur Overrides
- **AND** Coverage-Reporter sind konsistent über alle Packages

---

## ADDED Requirements

### Requirement: Nx Caching für Test-Targets
Das System SHALL Nx Caching für Test-Targets standardmäßig aktivieren und korrekte Cache-Inputs/-Outputs definieren.

#### Scenario: Named Inputs für Testing
- **GIVEN** `nx.json` im Root existiert
- **WHEN** namedInputs definiert sind
- **THEN** existiert ein `testing` Named Input
- **AND** `testing` umfasst Test-Files (`**/*.{test,spec}.{ts,tsx}`)
- **AND** `testing` umfasst zentrale Test-Configs (vitest.config.ts, vitest.workspace.ts)

#### Scenario: Cache-Output-Definition
- **WHEN** Coverage-Target in nx.json definiert wird
- **THEN** sind outputs explizit gesetzt: `["{projectRoot}/coverage"]`
- **AND** Nx restored Coverage-Verzeichnis bei Cache Hit
- **AND** Coverage-Artefakte sind identisch zu Fresh-Run

#### Scenario: Cache-Debugging
- **GIVEN** ein Entwickler vermutet falsche Cache-Hits
- **WHEN** er `--skip-nx-cache` Flag nutzt
- **THEN** wird Cache komplett umgangen
- **AND** Fresh-Run zeigt, ob Fehler reproduzierbar ist
- **AND** `nx reset` cleared Cache lokal

---

### Requirement: Zentrale Vitest-Workspace-Konfiguration
Das System SHALL eine vitest.workspace.ts im Root bereitstellen, die als Single Source of Truth für Test-Konfiguration dient.

#### Scenario: Workspace-Config im Root
- **GIVEN** Monorepo-Root
- **WHEN** `vitest.workspace.ts` existiert
- **THEN** definiert es globale Test-Defaults (environment, coverage provider)
- **AND** entdeckt automatisch alle Package-Configs (`apps/*/vitest.config.ts`, `packages/*/vitest.config.ts`)
- **AND** alle Test-Runs nutzen konsistente Reporter

#### Scenario: Package-Config-Vereinfachung
- **GIVEN** ein Package hat vitest.config.ts
- **WHEN** zentrale Workspace-Config existiert
- **THEN** kann Package-Config auf Projekt-spezifische Overrides reduziert werden
- **AND** `cwd` Parameter in project.json Targets ist nicht mehr erforderlich
- **AND** Coverage-Reporter-Definitionen entfallen (zentral definiert)

#### Scenario: Migration bestehender Configs
- **GIVEN** bestehende Packages mit individuellen vitest.config.ts
- **WHEN** Workspace-Config eingeführt wird
- **THEN** bleiben alte Configs kompatibel (Backward-Compat)
- **AND** schrittweise Migration ist möglich (Package für Package)
- **AND** beide Ansätze koexistieren während Übergangsphase

---

### Requirement: TypeScript-basiertes Tooling
Das System SHOULD TypeScript für kritisches Monorepo-Tooling verwenden, inklusive Coverage-Gate-Scripts.

#### Scenario: TypeScript-Script-Execution via tsx
- **GIVEN** `scripts/ci/coverage-gate.ts` existiert
- **WHEN** Script via `pnpm coverage-gate` ausgeführt wird
- **THEN** wird TypeScript via `tsx` transparent kompiliert
- **AND** kein Pre-Build-Step erforderlich
- **AND** Entwickler hat IDE-Support (Autocomplete, Type-Checking)

#### Scenario: Type-sichere Konfigurationen
- **GIVEN** Coverage-Policy als JSON-Datei
- **WHEN** TypeScript-Script Policy lädt
- **THEN** validiert TypeScript-Interface Struktur zur Compile-Zeit
- **AND** invalide Policy führt zu Type-Error (nicht Runtime-Error)
- **AND** Refactorings (z.B. neues Policy-Feld) sind IDE-unterstützt
