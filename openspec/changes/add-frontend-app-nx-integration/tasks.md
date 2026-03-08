# Implementation Tasks

## 0. Governance

- [ ] 0.1 Proposal, Design und Spec-Delta mit dem Team abstimmen
- [ ] 0.2 Betroffene arc42-Abschnitte aktualisieren oder eine begründete Abweichung dokumentieren
- [ ] 0.3 Entwicklerdokumentation für den Nx-Workflow der Frontend-App aktualisieren

## 1. Nx-Executor-Grundlage

- [ ] 1.1 Passende Nx-Plugins für Vite, Vitest und Playwright in kompatibler Version zum Workspace ergänzen
- [ ] 1.2 Entscheiden, welche Targets explizit in `apps/sva-studio-react/project.json` verbleiben und welche optional aus Plugin-Defaults abgeleitet werden dürfen
- [ ] 1.3 Zielkonfiguration für `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` festlegen

## 2. Frontend-Targets migrieren

- [ ] 2.1 `build` auf einen dedizierten Vite-basierten Nx-Executor umstellen
- [ ] 2.2 `serve` auf einen dedizierten Dev-Server-Executor umstellen
- [ ] 2.3 `test:unit` und `test:coverage` auf einen dedizierten Vitest-basierten Nx-Executor mit klaren Konfigurationen umstellen
- [ ] 2.4 `test:e2e` auf einen dedizierten Playwright-basierten Nx-Executor umstellen
- [ ] 2.5 `lint` auf `@nx/eslint:lint` konsistent halten und unnötige Fremdoptionen entfernen
- [ ] 2.6 Für alle wesentlichen Frontend-Targets explizite `inputs` und `outputs` in `project.json` hinterlegen

## 3. Cache- und Input-Modell schärfen

- [ ] 3.1 Workspace- oder projektbezogene `namedInputs` für Frontend-Konfigurationsdateien definieren
- [ ] 3.2 Env-relevante Inputs für Build-, Serve-, Test- und E2E-Targets explizit deklarieren
- [ ] 3.3 Sicherstellen, dass Nx bei Änderungen an Frontend-Konfiguration oder Env-Einflüssen korrekt invalidiert

## 4. Verifikation

- [ ] 4.1 `pnpm nx show project sva-studio-react` prüfen und Zielkonfiguration verifizieren
- [ ] 4.2 Relevante Targets über Nx ausführen (`build`, `serve`, `test:unit`, `test:coverage`, `test:e2e`, `lint`)
- [ ] 4.3 `pnpm test:unit`, `pnpm test:types` und `pnpm test:eslint` mit der neuen Konfiguration erfolgreich ausführen
