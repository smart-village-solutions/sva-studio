## 1. Scaffold Basisstruktur
- [ ] 1.1 Projekte anlegen: `apps/studio` (React Shell, leer) und Packages: `packages/sdk`, `packages/core`, `packages/data`, `packages/auth`, `packages/ui-contracts`, `packages/runtime-react`, `packages/theme-engine`, `packages/app-config`
- [ ] 1.2 Nx-Projekte/`project.json`/`workspace`-Einträge erstellen (lint/test/build Targets, auch wenn minimal)
- [ ] 1.3 Platzhalter-Code/README pro Projekt, damit Targets laufen (keine Feature-Logik)

## 2. Tooling & Boundaries
- [ ] 2.1 TypeScript Path-Mappings für `@cms/*` definieren
- [ ] 2.2 ESLint Boundary-Regeln für verbotene Importe (Plugins dürfen nicht aus Host importieren; core/sdks ohne UI-Imports)
- [ ] 2.3 CI anpassen: `nx affected -t lint,test,build` über alle neuen Projekte; graceful skip bei fehlenden Projekten vermeiden

## 3. Validierung
- [ ] 3.1 `npm run lint`/`npm run test`/`npx nx build <one>` gegen die neuen Projekte
- [ ] 3.2 `npx nx graph` prüfen
- [ ] 3.3 `openspec validate add-nx-foundation-structure --strict`
