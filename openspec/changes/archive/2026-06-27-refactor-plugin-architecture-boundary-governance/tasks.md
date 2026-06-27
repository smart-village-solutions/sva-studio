## 1. Vertrag und Spezifikation

- [x] 1.1 OpenSpec-Deltas fuer `monorepo-structure` und `plugin-platform` anlegen
- [x] 1.2 Guide und Architekturdoku auf Standard Path und Advanced Path ausrichten
- [x] 1.3 `openspec validate refactor-plugin-architecture-boundary-governance --strict` erfolgreich ausfuehren

## 2. Boundary-Check

- [x] 2.1 Vitest-Tests fuer Workspace-Dependencies, Workspace-Imports, Path-Signals und Baseline-Diff schreiben
- [x] 2.2 `scripts/ci/check-plugin-architecture-boundary.ts` implementieren
- [x] 2.3 `package.json` und `scripts/ci/run-pr-gate.ts` um das neue blockierende Gate erweitern

## 3. Brownfield und Governance

- [x] 3.1 `docs/reports/plugin-architecture-boundary-baseline.md` mit aktuellen Altverstoessen anlegen
- [x] 3.2 Review-Governance fuer Advanced-Path-Nutzung, Baseline-Aenderungen und neue Plugin-Faehigkeiten schaerfen
- [x] 3.3 Folgearbeit fuer den `@sva/studio-module-iam`-Schlupfloch-Abbau benennen, ohne denselben Change mit einem strukturellen Grossumbau zu ueberladen

## 4. Verifikation

- [x] 4.1 `pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts`
- [x] 4.2 `pnpm exec vitest run scripts/ci/run-pr-gate.test.ts`
- [x] 4.3 `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- [x] 4.4 `pnpm check:plugin-architecture-boundary`
