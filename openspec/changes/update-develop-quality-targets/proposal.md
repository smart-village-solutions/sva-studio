# Change: Develop-Qualitätsziele für Lint, Unit-Tests und Target-Konventionen schärfen

## Why

Der aktuelle `develop`-Stand enthält mehrere Platzhalter-Targets ("not configured") für `lint` und einzelne `test:unit`-Runs. Dadurch entstehen blinde Flecken im Review und in der CI, obwohl fachlich relevante Pakete bereits produktionsnahen Code enthalten.

Ziel ist ein konsistenter, prüfbarer Qualitäts-Standard auf Branch-Ebene, damit Reviewer weniger manuell nachprüfen müssen und regressionsanfällige Änderungen früher auffallen.

## What Changes

- Reale `lint`-Targets für App und Packages statt Platzhalter-Kommandos einführen.
- Für `@sva/monitoring-client` echte `test:unit`-Ausführung aktivieren (statt No-Op), inklusive bestehender/ergänzter Unit-Tests.
- Nx-Target-Konventionen im Workspace vereinheitlichen (`lint`, `test:unit`, optional `test:coverage`/`test:integration`) und in betroffenen `project.json`-Dateien konsistent anwenden.
- Reviewer-orientierte Dokumentation aktualisieren: klare Aussage, welche Projekte coverage-exempt sind, warum, und wie diese Entscheidung überprüft wird.

## Out of Scope

- Keine Neubewertung der Exemption-Strategie für `core`, `data` oder `plugin-example`.
- Keine Einführung neuer Testarten oder neuer CI-Plattformen.

## Impact

- Affected specs:
  - `monorepo-structure` (MODIFIED)
  - `test-coverage-governance` (MODIFIED)
- Affected code:
  - `apps/sva-studio-react/project.json`
  - `packages/*/project.json` (betroffene Projekte)
  - `packages/monitoring-client/tests/*`
  - Root-Skripte in `package.json`/Nx-Konfiguration (falls für Konventionsangleichung erforderlich)
  - `docs/development/testing-coverage.md` und ggf. PR-Checklisten-Doku

## Success Criteria

- `nx run-many -t lint` führt in allen aktiven Projekten echte Lint-Prüfungen aus.
- `@sva/monitoring-client:test:unit` führt echte Unit-Tests aus und schlägt bei Defekten fehl.
- Target-Namenskonventionen sind im Workspace konsistent und in der Doku nachvollziehbar.
- Reviewer finden Exemption-Informationen zentral und aktuell dokumentiert.
