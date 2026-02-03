## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Build- und Target-Konventionen
Das System SHALL standardisierte Nx Targets für build, test und lint bereitstellen, **vorrangig über Nx-Generatoren (@nx/js:lib) erstellt**.

#### Scenario: Automatische Targets via Generator
- **WHEN** ein Package via `nx g @nx/js:lib` erstellt wird
- **THEN** werden build (tsc), test (vitest optional), lint (eslint optional) automatisch konfiguriert
- **AND** project.json wird mit korrekten Executor-Definitionen generiert
- **AND** `nx build <package>`, `nx test <package>` sind sofort verfügbar

#### Scenario: Targets im Projektgraph sichtbar
- **WHEN** `nx graph` ausgeführt wird
- **THEN** sind alle Targets und deren Abhängigkeiten sichtbar
- **AND** affected-Commands funktionieren zuverlässig
