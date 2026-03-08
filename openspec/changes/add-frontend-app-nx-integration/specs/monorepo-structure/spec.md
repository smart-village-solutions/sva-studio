## ADDED Requirements

### Requirement: Dedizierte Nx-Executor für die Frontend-App
Die Web-App `apps/sva-studio-react` SHALL ihre zentralen Entwicklungs- und Qualitäts-Tasks über dedizierte Nx-Executor statt über generische `nx:run-commands` abbilden.

#### Scenario: Zentrale App-Targets nutzen dedizierte Executor
- **WHEN** `apps/sva-studio-react/project.json` geprüft wird
- **THEN** verwenden `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` jeweils einen fachlich passenden Nx-Executor
- **AND** keiner dieser Targets verwendet `nx:run-commands`

#### Scenario: Frontend-Tooling ist Nx-nativ eingebunden
- **WHEN** die Frontend-App über Nx lokal oder in CI ausgeführt wird
- **THEN** sind Build und Dev-Server an Vite-basierte Nx-Executor gebunden
- **AND** Unit-Tests und Coverage an einen Vitest-basierten Nx-Test-Executor
- **AND** E2E-Tests an einen Playwright-basierten Nx-Executor

### Requirement: Vollständige Frontend-Targets mit expliziten Inputs und Outputs
Die Web-App `apps/sva-studio-react` SHALL alle wesentlichen Frontend-Aufgaben als explizite Nx-Targets mit nachvollziehbaren `inputs` und `outputs` in `project.json` definieren.

#### Scenario: Zielmenge ist vollständig
- **WHEN** `apps/sva-studio-react/project.json` geprüft wird
- **THEN** sind mindestens `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` vorhanden
- **AND** jedes dieser Targets definiert explizite `inputs`
- **AND** jedes dieser Targets definiert explizite `outputs`

#### Scenario: Artefakt-Targets deklarieren ihre Ergebnisse
- **WHEN** `build`, `test:coverage` oder `test:e2e` ausgeführt werden
- **THEN** verweisen ihre `outputs` auf die tatsächlich erzeugten Artefaktverzeichnisse der Frontend-App
- **AND** Nx kann diese Artefakte bei Cache-Hits wiederherstellen

#### Scenario: Nicht-artefaktproduzierende Targets sind explizit markiert
- **WHEN** `serve`, `lint` oder `test:unit` geprüft werden
- **THEN** definieren diese Targets `outputs: []`
- **AND** ihre Wirkung bleibt für Entwickler und Reviewer in `project.json` eindeutig

### Requirement: Cache-relevante Frontend-Inputs sind dokumentiert
Das System SHALL cache-relevante Konfigurations- und Environment-Einflüsse der Frontend-App über `namedInputs` oder target-spezifische `inputs` deklarieren.

#### Scenario: Frontend-Konfiguration invalidiert Cache
- **WHEN** sich `apps/sva-studio-react/vite.config.ts`, `apps/sva-studio-react/vitest.config.ts`, `apps/sva-studio-react/playwright.config.ts`, `apps/sva-studio-react/tailwind.config.cjs`, `apps/sva-studio-react/postcss.config.cjs`, `apps/sva-studio-react/tsconfig.json` oder `apps/sva-studio-react/package.json` ändern
- **THEN** werden betroffene Frontend-Targets nicht aus einem veralteten Nx-Cache bedient

#### Scenario: Environment-Einflüsse sind Teil des Cache-Modells
- **WHEN** sich für Build, Serve, Test oder E2E relevante Environment-Einflüsse ändern
- **THEN** invalidiert Nx den Cache für die betroffenen Frontend-Targets
- **AND** die betroffenen Env-Einflüsse sind in `nx.json` oder `apps/sva-studio-react/project.json` nachvollziehbar deklariert
