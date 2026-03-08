# Change: Dedizierte Nx-Integration für die Frontend-App

## Why

`apps/sva-studio-react/project.json` bildet zentrale Frontend-Aufgaben aktuell überwiegend über `nx:run-commands` ab. Dadurch bleiben die eigentlichen Tooling-Semantiken von Vite, Vitest und Playwright für Nx unscharf: Targets sind nur eingeschränkt standardisiert, `inputs` und `outputs` sind nicht durchgängig explizit dokumentiert und cache-relevante Konfigurations- bzw. Environment-Einflüsse sind nicht sauber modelliert.

Für die Frontend-App brauchen wir deshalb eine Nx-native Konfiguration, damit Build, Dev-Server, Tests und Linting konsistent über den Projektgraphen, `affected`-Auswertungen und Cache-Regeln gesteuert werden können.

## What Changes

- `sva-studio-react` wird von generischen `nx:run-commands` auf dedizierte Nx-Executor für Build, Serve, Unit-Tests, Coverage, E2E und Linting umgestellt
- `apps/sva-studio-react/project.json` definiert die wesentlichen Frontend-Targets mit expliziten `inputs` und `outputs`
- Cache-relevante Konfigurationsdateien und Env-Einflüsse der Frontend-App werden über `namedInputs` oder target-spezifische `inputs` nachvollziehbar modelliert
- Die Workspace-Konfiguration wird um die für Vite, Vitest und Playwright erforderlichen Nx-Plugins bzw. Executor-Konfigurationen ergänzt
- Relevante Architektur- und Entwicklungsdokumentation wird für die neue Nx-Target-Strategie aktualisiert

## Impact

- **Affected specs:** `monorepo-structure`
- **Affected code:**
  - `apps/sva-studio-react/project.json`
  - `apps/sva-studio-react/package.json`
  - `apps/sva-studio-react/vite.config.ts`
  - `apps/sva-studio-react/vitest.config.ts`
  - `apps/sva-studio-react/playwright.config.ts`
  - `nx.json`
  - `package.json`
  - `pnpm-lock.yaml`
  - `docs/development/*` (falls für den lokalen Workflow erforderlich)
- **Affected arc42 sections:**
  - `04-solution-strategy`
  - `05-building-block-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`
