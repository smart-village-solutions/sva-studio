# Verifikation: IAM Plattform-/Tenant-Rollenmodell 2026-06-05

## Ziel

Dieser Bericht definiert den kleinsten relevanten Verifikationspfad für den Change `refactor-iam-platform-tenant-role-model` und hält die heute ausgeführten technischen Nachweise fest.

## Relevante Mindest-Gates

### 1. Unit- und Regressionstests für Bootstrap-, Reconcile- und UI-Pfade

- `pnpm exec vitest run packages/instance-registry/src/service.test.ts packages/data-repositories/src/instance-registry/index.test.ts`
- `pnpm exec vitest run src/routes/admin/instances/-instance-detail-page.test.tsx src/routes/admin/instances/-instance-create-page.test.tsx src/routes/admin/modules/-modules-page.test.tsx --config vitest.routes.config.ts`

Zweck:

- Tenant-Bootstrap nur noch auf `system_admin`
- Root-Follow-up ohne Re-Introduktion von Legacy-Admin-Strukturen
- Drift-/Diagnoseprojektionen im Root-Host

### 2. Typ- und Runtime-Gates für Repository- und Migrationspfade

- `pnpm exec tsc -p packages/instance-registry/tsconfig.lib.json --noEmit`
- `pnpm exec tsc -p packages/data-repositories/tsconfig.lib.json --noEmit`
- `pnpm nx run data:test:unit --testFiles=src/runtime-safety.test.ts`

Zweck:

- Typsicherheit der Bootstrap-/Reconcile-Pfade
- additive SQL-Migrationsverträge `0050` und `0051`
- Schutz gegen unbeabsichtigte Reaktivierung tenantseitiger `instance_registry_admin`-Artefakte

### 3. Affected-Gates vor Commit oder Push

- `pnpm nx affected --target=test:unit --base=origin/main`
- bei Typ- oder Vertragsänderungen zusätzlich `pnpm nx affected --target=test:types --base=origin/main`
- bei serverseitigen Workspace-Package-Änderungen zusätzlich früh `pnpm check:server-runtime`

Zweck:

- minimaler PR-Gate-Pfad für Regressionen im Monorepo
- Schutz gegen Node-ESM- und Dist-Runtime-Brüche

### 4. E2E-Nachweis für Root-Control-Plane und Tenant-Admin-Flows

- `pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/account-admin-ui.spec.ts`

Abgedeckte Szenarien:

- Root-Control-Plane-Detailpfad für `instance_registry_admin`
- Create-Flow mit `Tenant-Admin-Struktur jetzt anlegen`
- tenantlokale Benutzerverwaltung für `system_admin`
- fail-closed-Verhalten bei fehlendem Tenant-Admin-Client

## Heute ausgeführte Nachweise

- `pnpm exec vitest run packages/instance-registry/src/service.test.ts packages/data-repositories/src/instance-registry/index.test.ts` erfolgreich
- `pnpm exec vitest run src/routes/admin/instances/-instance-detail-page.test.tsx src/routes/admin/instances/-instance-create-page.test.tsx src/routes/admin/modules/-modules-page.test.tsx --config vitest.routes.config.ts` erfolgreich
- `pnpm exec vitest run packages/data-repositories/src/instance-registry/index.test.ts` erfolgreich
- `pnpm exec tsc -p packages/instance-registry/tsconfig.lib.json --noEmit` erfolgreich
- `pnpm exec tsc -p packages/data-repositories/tsconfig.lib.json --noEmit` erfolgreich
- `pnpm nx run data:test:unit --testFiles=src/runtime-safety.test.ts` erfolgreich
- `pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/account-admin-ui.spec.ts` erfolgreich
- `openspec validate refactor-iam-platform-tenant-role-model --strict` erfolgreich

## Einordnung

- Die Kernpfade für Rollenmodell, Bootstrap, Drift-Erkennung, Migrationsverträge und die zentralen Browser-Flows sind technisch abgesichert.
- Für diesen Change bleibt im OpenSpec-Taskstand kein offener Verifikationsblock mehr.
