## 1. Workspace Initialization
- [x] 1.1 Initialize Nx integrated workspace at repo root using npm and skip nx cloud
- [x] 1.2 Ensure no nested directory is created; all config lives at repository root
- [x] 1.3 Keep git history intact (no git re-init)

## 2. Tooling Alignment
- [x] 2.1 Ensure Prettier config remains effective and not overridden
- [x] 2.2 Add/verify basic lint/test scripts from Nx preset

## 3. Validation
- [x] 3.1 Run `npm install` (or reuse install from init) and ensure clean `npm run lint`/`npm run test` (if generated)
- [x] 3.2 Run `npx nx show project` (or `npx nx graph`) to confirm workspace health

## 4. Nächste Schritte (Nx Ausbau)
- [x] 4.1 Plugins auswählen/installieren für geplante Stacks (z. B. `@nx/react`, `@nx/node`, `@nx/jest`, `@nx/eslint`)
- [x] 4.2 Standard-Targets/Defaults setzen (z. B. `targetDefaults` für `lint`, `test`, `build`, `format`)
- [x] 4.3 Workspace-Config für CI vorbereiten (Cache/Pipeline: `nx.json` + CI-Job mit `nx affected`)
- [x] 4.4 Editor/Dev-Ergonomie: VS Code Extensions/Settings empfehlen, ggf. `tools/`-Skripte ergänzen
- [ ] 4.5 Security/Policy: Audit der neuen Dependencies, SBOM/Lizenz-Check in Pipeline vorsehen
