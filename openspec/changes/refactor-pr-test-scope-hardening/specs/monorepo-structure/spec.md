## ADDED Requirements

### Requirement: Tooling-Testing deckt CI- und Workflow-Governance gezielt ab
Das Monorepo SHALL ein dediziertes `tooling-testing`-Projekt bereitstellen, das PR-Gate-Skripte, Workflow-Kontrakte und Root-Tooling-Dateien gezielt absichert.

#### Scenario: Workflow-Datei ändert den Tooling-Test-Scope
- **WHEN** eine Datei unter `.github/workflows/**` geändert wird
- **THEN** wird `tooling-testing` im affected-Graph berücksichtigt
- **AND** sein Lint- und Unit-Test-Target können die Änderung gezielt validieren

#### Scenario: CI-Skript ändert den Tooling-Test-Scope
- **WHEN** eine Datei unter `scripts/ci/**` geändert wird
- **THEN** wird `tooling-testing` im affected-Graph berücksichtigt
- **AND** Contract-Tests für PR-Scope- und Gate-Logik laufen gegen diese Änderung

#### Scenario: Root-Tooling-Datei ändert den Tooling-Test-Scope
- **WHEN** Root-`package.json` oder `tsconfig.scripts.json` geändert werden
- **THEN** wird `tooling-testing` im affected-Graph berücksichtigt
- **AND** die Änderung wird nicht nur über pauschale Voll-Läufe der Produkt-Suite abgesichert
