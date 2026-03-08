# Change: Nx-Workspace-Hygiene und Test-Coverage-Floors anheben

## Why

Ein Workspace-Review hat mehrere Inkonsistenzen in der Nx-Konfiguration identifiziert, die die Entwicklungserfahrung, CI-Zuverlässigkeit und Test-Governance beeinträchtigen:

**Nx-Inkonsistenzen:**
- **NX-3 (Mittel):** `@sva/routing` fehlt in `tsconfig.base.json` paths – IDE-Auflösung kann fehlschlagen
- **NX-4 (Mittel):** SDK Sub-Path-Exports (`@sva/sdk/logger/...`, `@sva/sdk/middleware/...`, `@sva/sdk/observability/...`) sind nicht in `tsconfig.base.json` gemappt
- **NX-5 (Niedrig):** Inkonsistente Lint-Executors: `auth` und `monitoring-client` nutzen `nx:run-commands` statt `@nx/eslint:lint`
- **NX-6 (Mittel):** `routing` Package hat Target `test` statt `test:unit` – wird von `nx affected --target=test:unit` nicht erfasst
- **NX-7 (Niedrig):** `routing` hat Tag `type:core` statt `type:lib` – inkonsistente Tag-Taxonomie

**Test-Governance:**
- **TEST-1 (Hoch):** Coverage-Floors in `coverage-policy.json` stehen auf **0%** – neue Packages können ohne Tests gemerged werden
- **TEST-2 (Hoch):** Testabdeckung ist weiterhin ungleichmäßig (`authorization-engine`, `claims` in `core` fehlen als Unit-Tests)
- **COV-1:** `runCoverageGate` wurde verbessert, ist aber weiterhin groß und soll weiter modularisiert werden

**Stand 2026-03-08 (Refresh):**
- Bereits umgesetzt: `field-encryption.test.ts`, `auth.routes.server.test.ts`, vorhandene `vitest.config.ts` für `core` und `routing`
- Obsolet: Die frühere C-4-Annahme (`Buffer.from()` in `token.ts`) ist nicht mehr zutreffend; kein `.server.ts`-Rename erforderlich

## What Changes

### 1. tsconfig.base.json Paths ergänzen (NX-3, NX-4)
- `@sva/routing` als Path-Mapping hinzufügen
- SDK Sub-Path-Exports (`./server`, `./logger/index.server`, `./middleware/request-context.server`, `./observability/context.server`) hinzufügen

### 2. Routing-Package Nx-Konfiguration bereinigen (NX-6, NX-7)
- Target `test` → `test:unit` umbenennen in `packages/routing/project.json`
- Tag `type:core` → `type:lib` ändern
- `lint`-Target hinzufügen (fehlt komplett)

### 3. Lint-Executors vereinheitlichen (NX-5)
- `auth` und `monitoring-client` `project.json`: `lint`-Target auf `@nx/eslint:lint` umstellen (wie core, data, sdk)

### 4. Coverage-Floors anheben (TEST-1)
- `tooling/testing/coverage-policy.json`: Globale Floors von 0% auf realistische Werte anheben
- Package-spezifische Floors setzen basierend auf aktueller Baseline + Ratcheting

### 5. Basis-Tests für kritische Core-/Routing-Pfade ergänzen (TEST-2)
- Bereits vorhanden: Unit-Tests für `packages/core/src/security/field-encryption.ts`
- Bereits vorhanden: Unit-Tests für `packages/routing/src/auth.routes.server.ts`
- Offen: Unit-Tests für `packages/core/src/iam/authorization-engine.ts` und `packages/core/src/iam/claims.ts`

### 6. Coverage-Gate-Komplexität reduzieren (COV-1)
- `scripts/ci/coverage-gate.ts`: `runCoverageGate`-Funktion in Subfunktionen aufteilen (Cognitive Complexity < 15)

## Impact
- Affected specs: `monorepo-structure`, `test-coverage-governance`
- Affected code:
  - `tsconfig.base.json` (NX-3, NX-4)
  - `packages/routing/project.json` (NX-6, NX-7)
  - `packages/auth/project.json`, `packages/monitoring-client/project.json` (NX-5)
  - `tooling/testing/coverage-policy.json` (TEST-1)
  - `packages/core/src/iam/authorization-engine.test.ts`, `packages/core/src/iam/claims.test.ts` (TEST-2)
  - `scripts/ci/coverage-gate.ts` (COV-1)
- Affected arc42 sections: `05-building-block-view` (Modul-Konfiguration), `10-quality-requirements` (Coverage-Ziele)
