## 1. Workspace Initialization
- [ ] 1.1 Initialize Nx integrated workspace at repo root using npm and skip nx cloud
- [ ] 1.2 Ensure no nested directory is created; all config lives at repository root
- [ ] 1.3 Keep git history intact (no git re-init)

## 2. Tooling Alignment
- [ ] 2.1 Ensure Prettier config remains effective and not overridden
- [ ] 2.2 Add/verify basic lint/test scripts from Nx preset

## 3. Validation
- [ ] 3.1 Run `npm install` (or reuse install from init) and ensure clean `npm run lint`/`npm run test` (if generated)
- [ ] 3.2 Run `npx nx show project` (or `npx nx graph`) to confirm workspace health
- [ ] 3.3 `git status` clean and document changes in PR
