# Capability: monorepo-structure

## Purpose
Definiert die Nx-basierte Monorepo-Struktur für SVA Studio, inklusive Package-Management, Build-Konventionen und Generatoren für konsistente Entwicklungs-Workflows.
## Requirements
### Requirement: Monorepo-Grundstruktur
Das System SHALL eine Nx Integrated Monorepo-Struktur mit getrennten Bereichen für Apps und Packages bereitstellen.

#### Scenario: Workspace-Struktur vorhanden
- **WHEN** das Repository initialisiert ist
- **THEN** existieren mindestens apps/, packages/, tooling/ und scripts/

### Requirement: Publishable Packages und Plugins
Das System SHALL Packages als eigenständige npm-Module organisieren, inklusive klarer Namenskonventionen für Core und Plugins.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie @sva/* und Plugins verwenden @sva/plugin-*

### Requirement: App-Stack Definition
Das System SHALL eine Web-App unter apps/sva-studio-react mit React und TanStack Start bereitstellen.

#### Scenario: Start-App vorhanden
- **WHEN** das Workspace-Setup abgeschlossen ist
- **THEN** existiert apps/sva-studio-react als TanStack-Start-App

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

### Requirement: Package-Erstellung via @nx/js:lib Generator
Das System SHALL neue Packages primär über `nx g @nx/js:lib` mit SVA-Konventionen erstellen, um automatisch korrekte Targets, TypeScript-Setup und Projektgraph-Integration zu garantieren.

#### Scenario: Standard Library mit @nx/js:lib erstellen
- **GIVEN** ein Entwickler möchte ein neues Package erstellen
- **WHEN** er `nx g @nx/js:lib my-package --directory=packages/my-package --importPath=@sva/my-package --tags=scope:shared,type:lib --bundler=tsc` ausführt
- **THEN** wird ein Package mit korrekter TypeScript-Struktur generiert
- **AND** `project.json` mit build/test/lint Targets wird erstellt
- **AND** tsconfig.base.json wird automatisch mit Path-Mapping aktualisiert
- **AND** Package erscheint sofort im Nx-Projektgraphen

#### Scenario: Schneller Workflow mit npm-Script
- **GIVEN** ein `pnpm new:lib` npm-Script existiert im Root
- **WHEN** ein Entwickler `pnpm new:lib my-package` ausführt
- **THEN** wird der @nx/js:lib Generator mit SVA-Defaults aufgerufen
- **AND** manuelle Flag-Eingaben entfallen

#### Scenario: Plugin mit Peer Dependencies
- **GIVEN** ein Plugin soll @sva/core als Peer Dependency haben
- **WHEN** Generator ausgeführt wird
- **THEN** kann `--tags=scope:plugin` verwendet werden
- **AND** Entwickler ergänzt Peer Dependencies manuell nach Bedarf in package.json

### Requirement: Manuelles Package-Setup für Sonderfälle
Das System SHALL manuelles Setup dokumentieren und erlauben, wenn Generator nicht passt (z.B. komplexe Build-Setups, externe Packages, Experimentelles).

#### Scenario: Externe Library ins Monorepo integrieren
- **GIVEN** eine bestehende npm-Library soll als Workspace-Package integriert werden
- **WHEN** die Library spezielle package.json-Konfiguration benötigt
- **THEN** kann manuelles Setup statt Generator verwendet werden
- **AND** Dokumentation warnt vor Nachteilen (keine Targets, kein Full-Graph-Support)
- **AND** dev muss Projekt manuell in nx.json/project.json registrieren

#### Scenario: Dokumentation von Generator vs. Manuell
- **GIVEN** Dokumentation in docs/monorepo.md
- **WHEN** ein Entwickler konsultiert sie
- **THEN** klare Guidance: Generator als Standard (~90%), Manuell nur wenn nötig (~10%)
- **AND** Nachteile der manuellen Methode sind erklärt
- **AND** Beispiele für beide Wege vorhanden

### Requirement: Generator-Workflows in Dokumentation
Das System SHALL klare, wiederverwendbare Generator-Commands und Workflows dokumentieren.

#### Scenario: Dokumentierte Generator-Commands
- **GIVEN** Entwickler liest docs/monorepo.md
- **WHEN** er ein neues Package erstellen möchte
- **THEN** findet er Copy-Paste-Ready Commands mit SVA-Defaults
- **AND** Erklärungen für jeden Flag sind vorhanden
- **AND** Verlinkung zu Nx-Dokumentation ist enthalten

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
Das System SHALL TypeScript für kritisches Monorepo-Tooling verwenden, inklusive Coverage-Gate-Scripts.

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

