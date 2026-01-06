# Change: Nx Foundation Struktur (Scaffold)

## Warum
Um das Nx-Experiment produktionsnäher zu machen, brauchen wir eine klare Grundstruktur für Apps/Packages, Pfad-Aliasse und Boundaries. Das reduziert spätere Umbauten, gibt dem Plugin-Modell einen Rahmen und erlaubt frühe CI-Checks.

## Was ändert sich
- Grundgerüst für Apps/Packages anlegen (React-Admin-Shell + Kern-Pakete wie sdk/core/data/auth/ui-contracts/runtime-react/theme-engine/app-config, ohne Feature-Code)
- TypeScript-Pfadaliase und ESLint-Boundary-Regeln definieren (keine Host-Imports aus Plugins, nur `@cms/*` erlauben)
- Nx-Projekt-Configs/Targets (lint/test/build) für die neuen Platzhalter setzen, CI anpassen, sodass Targets existieren und durchlaufen

## Impact
- Betroffene Specs: tooling
- Betroffene Bereiche: nx.json/project.json/tsconfig/eslint configs, CI-Workflow
