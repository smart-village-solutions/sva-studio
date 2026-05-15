## MODIFIED Requirements

### Requirement: Trennung von Unit- und Integrationstests
Das System SHALL infra-abhängige Integrationstests getrennt von Unit-Coverage-Gates ausführen.

#### Scenario: PR-Workflow
- **WHEN** ein Pull Request validiert wird
- **THEN** blockieren Unit-Coverage-Gates den PR
- **AND** Integrationstests können in PR optional separat laufen

#### Scenario: Nightly/Main Workflow
- **WHEN** Nightly oder Main-Pipeline ausgeführt wird
- **THEN** werden Integrationstests verpflichtend ausgeführt
- **AND** deren Ergebnis wird separat ausgewiesen

#### Scenario: Workflow- und CI-Dateien eskalieren Coverage nicht pauschal auf Voll-Läufe
- **GIVEN** ein Pull Request ändert nur `.github/workflows/**`, `scripts/ci/**` oder Root-Tooling-Metadaten ohne globale Workspace-Konfigurationsänderung
- **WHEN** das PR-Coverage-Gate seinen Scope bestimmt
- **THEN** eskaliert es nicht allein deshalb auf einen vollen Workspace-Coverage-Lauf
- **AND** die Absicherung erfolgt stattdessen über gezielte Tooling-Tests und Gate-Contracts

### Requirement: CI-Workflow-Optimierung via Concurrency
Das System SHALL redundante CI-Workflow-Runs via Concurrency-Control verhindern.

#### Scenario: Cancel-in-Progress für PR-Branches
- **GIVEN** ein PR hat mehrere schnell aufeinanderfolgende Commits
- **WHEN** neuer Commit gepusht wird während alter Workflow läuft
- **THEN** wird alter Workflow-Run gecancelt
- **AND** neuer Workflow startet sofort
- **AND** CI-Ressourcen werden für aktuellsten Code frei

#### Scenario: Main-Branch nie canceln
- **WHEN** Main-Branch Coverage-Workflow läuft
- **THEN** wird dieser niemals gecancelt (auch bei neuem Commit)
- **AND** Deployment-kritische Workflows bleiben intakt

#### Scenario: Quality- und Coverage-Eskalation bleibt globalen Workspace-Dateien vorbehalten
- **GIVEN** ein Pull Request ändert `pnpm-lock.yaml`, `nx.json`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.config.ts` oder `vitest.workspace.ts`
- **WHEN** das PR-Scope für Quality- und Coverage-Gates klassifiziert wird
- **THEN** dürfen `Lint`, `Unit`, `Types` und `Coverage` auf volle Läufe eskalieren
- **AND** andere Workflow- oder CI-Dateien lösen diese `full`-Eskalation nicht automatisch aus
