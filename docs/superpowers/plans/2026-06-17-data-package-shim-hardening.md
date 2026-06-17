# Data Package Shim Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@sva/data` auf ein reines DB-Operations- und Kompatibilitätspaket zurückführen, alle führenden Repository-Implementierungen nach `@sva/data-repositories` konsolidieren und die alte Doppelpflege dauerhaft verhindern.

**Architecture:** `@sva/data-repositories` bleibt die einzige führende Source of Truth für serverseitige Repository-Logik. `@sva/data` behält nur Migrations-/Seed-/Betriebsskripte sowie bewusst dokumentierte Re-Exports. Gedoppelte Implementierungen in `packages/data/src/**` werden in schmale Shims umgebaut oder entfernt; breite Doppeltests werden durch wenige Kompatibilitäts- und Guardrail-Tests ersetzt.

**Tech Stack:** TypeScript strict mode, Nx, Vitest, node:test, OpenSpec, Fallow, pnpm workspace

---

### Task 1: Architektur- und OpenSpec-Änderung festziehen

**Files:**
- Create: `openspec/changes/refactor-data-package-shim-cleanup/proposal.md`
- Create: `openspec/changes/refactor-data-package-shim-cleanup/design.md`
- Create: `openspec/changes/refactor-data-package-shim-cleanup/tasks.md`
- Create: `openspec/changes/refactor-data-package-shim-cleanup/specs/architecture-documentation/spec.md`
- Create: `openspec/changes/refactor-data-package-shim-cleanup/specs/monorepo-structure/spec.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/package-gesamtuebersicht.md`

- [ ] **Step 1: Write the failing spec delta and proposal**

```md
# Change: Refactor data package shim cleanup

## Why
`@sva/data` und `@sva/data-repositories` tragen weiterhin überlappende Persistenzverantwortung. Die Doppelpflege erzeugt Duplication, unklare Ownership und widerspricht der dokumentierten Zielarchitektur.

## What Changes
- `@sva/data-repositories` wird als einzige führende Repository-Schicht festgezogen.
- `@sva/data` wird auf Migrations-, Seed-, DB-Operations- und Kompatibilitätsverantwortung begrenzt.
- Gedoppelte Implementierungen und breite Spiegeltests in `packages/data/src/**` werden entfernt oder in Shims überführt.
- Guardrails verhindern neue fachliche Ownership in `@sva/data`.

## Impact
- Affected specs: `architecture-documentation`, `monorepo-structure`
- Affected code: `packages/data`, `packages/data-repositories`, `docs/architecture/*`, `tooling/testing` (falls Guardrail-Tests zentralisiert werden)
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`
```

- [ ] **Step 2: Run OpenSpec validation to verify it fails before the change is complete**

Run: `openspec validate refactor-data-package-shim-cleanup --strict`  
Expected: FAIL until proposal, tasks and spec deltas are complete and internally consistent

- [ ] **Step 3: Write the minimal approved architecture delta**

```md
## MODIFIED Requirements
### Requirement: Historisches Data-Package bleibt kontrollierter Kompatibilitätspfad
Das System MUST `@sva/data` ausschließlich als DB-Operations- und Kompatibilitätspaket führen.

#### Scenario: Neue Repository-Logik wird eingeordnet
- **WHEN** neue serverseitige Persistenz- oder Repository-Funktionalität entsteht
- **THEN** liegt die führende Implementierung in `@sva/data-repositories`
- **AND** `@sva/data` erhält höchstens einen dünnen Re-Export ohne eigene fachliche Ownership

#### Scenario: Bestehende Altpfade bleiben kontrolliert nutzbar
- **WHEN** bestehende Consumer weiterhin `@sva/data` oder `@sva/data/server` verwenden
- **THEN** delegiert das Package auf dokumentierte Zielpackages
- **AND** es führt keine parallele Implementierung derselben Repository-Funktionalität
```

- [ ] **Step 4: Re-run validation until the proposal passes**

Run: `openspec validate refactor-data-package-shim-cleanup --strict`  
Expected: PASS with no schema or scenario errors

- [ ] **Step 5: Commit the proposal and docs baseline**

```bash
git add \
  openspec/changes/refactor-data-package-shim-cleanup/proposal.md \
  openspec/changes/refactor-data-package-shim-cleanup/design.md \
  openspec/changes/refactor-data-package-shim-cleanup/tasks.md \
  openspec/changes/refactor-data-package-shim-cleanup/specs/architecture-documentation/spec.md \
  openspec/changes/refactor-data-package-shim-cleanup/specs/monorepo-structure/spec.md \
  docs/architecture/package-zielarchitektur.md \
  docs/architecture/package-gesamtuebersicht.md
git commit -m "docs: define @sva/data shim hardening change"
```

### Task 2: Führende Repository-Implementierungen aus `packages/data` entfernen

**Files:**
- Modify: `packages/data/src/iam/repositories.ts`
- Modify: `packages/data/src/iam/repositories/index.ts`
- Modify: `packages/data/src/iam/repositories/create-repository.ts`
- Modify: `packages/data/src/iam/repositories/statements.ts`
- Modify: `packages/data/src/iam/repositories/types.ts`
- Modify: `packages/data/src/integrations/instance-integrations.ts`
- Modify: `packages/data/src/integrations/instance-integrations.server.ts`
- Modify: `packages/data/src/index.ts`
- Modify: `packages/data/src/server.ts`
- Test: `packages/data/src/repository-shims.vitest.test.ts`

- [ ] **Step 1: Write the failing compatibility test**

```ts
import { describe, expect, it } from 'vitest';

import * as data from './index.js';
import * as repos from '@sva/data-repositories';
import * as dataServer from './server.js';
import * as reposServer from '@sva/data-repositories/server';

describe('@sva/data compatibility shims', () => {
  it('re-exports repository factories from the leading package', () => {
    expect(data.createIamSeedRepository).toBe(repos.createIamSeedRepository);
    expect(data.createInstanceIntegrationRepository).toBe(repos.createInstanceIntegrationRepository);
    expect(data.createWasteEmailReminderRepository).toBe(repos.createWasteEmailReminderRepository);
  });

  it('re-exports server helpers from the leading server entry', () => {
    expect(dataServer.loadExternalInterfaceRecordById).toBe(reposServer.loadExternalInterfaceRecordById);
    expect(dataServer.loadInstanceIntegrationRecord).toBe(reposServer.loadInstanceIntegrationRecord);
  });
});
```

- [ ] **Step 2: Run the focused compatibility test and confirm it fails on missing shim coverage**

Run: `pnpm nx run data:test:coverage --testFiles=src/repository-shims.vitest.test.ts`  
Expected: FAIL because the test file does not exist yet and the current package still mixes direct local implementation slices with re-export behavior

- [ ] **Step 3: Replace local implementations with thin shims**

```ts
// packages/data/src/iam/repositories.ts
export {
  createIamSeedRepository,
  iamSeedStatements,
} from '@sva/data-repositories';

export type {
  IamSeedRepository,
  SqlExecutionResult,
  SqlExecutor,
  SqlPrimitive,
  SqlStatement,
} from '@sva/data-repositories';
```

```ts
// packages/data/src/integrations/instance-integrations.ts
export {
  createCachedInstanceIntegrationLoader,
  createInstanceIntegrationRepository,
  instanceIntegrationStatements,
  DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS,
} from '@sva/data-repositories';

export type {
  CachedInstanceIntegrationLoader,
  InstanceIntegrationRecord,
  InstanceIntegrationRepository,
  IntegrationProviderKey,
  SqlExecutionResult,
} from '@sva/data-repositories';
```

```ts
// packages/data/src/integrations/instance-integrations.server.ts
export * from '@sva/data-repositories/server';
```

- [ ] **Step 4: Run the relevant package checks after the shim conversion**

Run: `pnpm nx run data:test:coverage --testFiles=src/repository-shims.vitest.test.ts`  
Expected: PASS

Run: `pnpm nx run data:test:types`  
Expected: PASS

- [ ] **Step 5: Commit the source-level deduplication**

```bash
git add \
  packages/data/src/iam/repositories.ts \
  packages/data/src/iam/repositories/index.ts \
  packages/data/src/iam/repositories/create-repository.ts \
  packages/data/src/iam/repositories/statements.ts \
  packages/data/src/iam/repositories/types.ts \
  packages/data/src/integrations/instance-integrations.ts \
  packages/data/src/integrations/instance-integrations.server.ts \
  packages/data/src/index.ts \
  packages/data/src/server.ts \
  packages/data/src/repository-shims.vitest.test.ts
git commit -m "refactor: replace @sva/data repository implementations with shims"
```

### Task 3: Gespiegelte Repository-Tests in `packages/data` auf Kompatibilitäts-Tests reduzieren

**Files:**
- Modify: `packages/data/src/media/index.vitest.test.ts`
- Modify: `packages/data/src/plugin-operations/index.vitest.test.ts`
- Modify: `packages/data/src/waste-management/email-reminders.vitest.test.ts`
- Modify: `packages/data/src/waste-management/master-data.vitest.test.ts`
- Modify: `packages/data/src/instance-registry/repository.vitest.test.ts`
- Modify: `packages/data/src/instance-registry/index.vitest.test.ts`
- Test: `packages/data-repositories/src/media/index.test.ts`
- Test: `packages/data-repositories/src/plugin-operations/index.test.ts`
- Test: `packages/data-repositories/src/waste-management/email-reminders.test.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Test: `packages/data-repositories/src/instance-registry/repository-reads.test.ts`

- [ ] **Step 1: Write the failing reduced compatibility tests**

```ts
import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data media compatibility', () => {
  it('re-exports the leading media repository factory', () => {
    expect(data.createMediaRepository).toBe(repos.createMediaRepository);
  });
});
```

```ts
describe('@sva/data plugin operation compatibility', () => {
  it('re-exports the leading studio job repository factory', () => {
    expect(data.createStudioJobRepository).toBe(repos.createStudioJobRepository);
  });
});
```

- [ ] **Step 2: Run the package-level Vitest suite and confirm the old broad copies are still present**

Run: `pnpm nx run data:test:coverage`  
Expected: FAIL or remain red until the broad duplicated behavior tests are removed or reduced to compatibility assertions

- [ ] **Step 3: Replace the broad mirrored tests with a small compatibility surface**

```ts
// packages/data/src/waste-management/email-reminders.vitest.test.ts
import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data waste reminder compatibility', () => {
  it('re-exports the leading waste email reminder repository factory', () => {
    expect(data.createWasteEmailReminderRepository).toBe(repos.createWasteEmailReminderRepository);
  });
});
```

```ts
// packages/data/src/instance-registry/index.vitest.test.ts
import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data instance registry compatibility', () => {
  it('re-exports the leading instance registry repository factory', () => {
    expect(data.createInstanceRegistryRepository).toBe(repos.createInstanceRegistryRepository);
  });
});
```

- [ ] **Step 4: Run the reduced compatibility suite and the leading repository suite**

Run: `pnpm nx run data:test:coverage`  
Expected: PASS with small compatibility tests only

Run: `pnpm nx run data-repositories:test:unit`  
Expected: PASS with the full repository behavior still covered in the leading package

- [ ] **Step 5: Commit the test deduplication**

```bash
git add \
  packages/data/src/media/index.vitest.test.ts \
  packages/data/src/plugin-operations/index.vitest.test.ts \
  packages/data/src/waste-management/email-reminders.vitest.test.ts \
  packages/data/src/waste-management/master-data.vitest.test.ts \
  packages/data/src/instance-registry/repository.vitest.test.ts \
  packages/data/src/instance-registry/index.vitest.test.ts
git commit -m "test: reduce @sva/data mirrored repository coverage"
```

### Task 4: `@sva/data` als DB-Operations- und Kompatibilitätspaket absichern

**Files:**
- Modify: `packages/data/README.md`
- Modify: `packages/data/package.json`
- Modify: `packages/data/project.json`
- Modify: `packages/data/src/runtime-safety.test.ts`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/package-gesamtuebersicht.md`

- [ ] **Step 1: Write the failing guardrail test for the allowed role**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

test('@sva/data root entries stay thin compatibility shims', () => {
  const indexSource = read('src/index.ts');
  const serverSource = read('src/server.ts');

  assert.match(indexSource, /export \* from '@sva\/data-repositories';/);
  assert.match(serverSource, /export \* from '@sva\/data-repositories\/server';/);
  assert.doesNotMatch(indexSource, /class |function |=> \{/);
  assert.doesNotMatch(serverSource, /class |function |=> \{/);
});
```

- [ ] **Step 2: Run the package unit target to verify the new guardrail is red before implementation**

Run: `pnpm nx run data:test:unit`  
Expected: FAIL until the new runtime-safety assertions and package docs/metadata match the intended role

- [ ] **Step 3: Tighten README, package metadata and test assertions around the narrowed role**

```json
// packages/data/package.json
{
  "name": "@sva/data",
  "dependencies": {
    "@sva/data-client": "workspace:*",
    "@sva/data-repositories": "workspace:*"
  }
}
```

```md
## Package role

`@sva/data` ist kein Zielpackage für neue Repository- oder Server-Fachlogik.

Erlaubt:
- Migrationen
- Seeds
- DB-Betriebsskripte
- dokumentierte Kompatibilitäts-Re-Exports

Nicht erlaubt:
- neue führende Persistenzimplementierungen
- neue fachliche Orchestrierung
- neue Sammelimporte als Bequemlichkeits-Fassade
```

- [ ] **Step 4: Run the full smallest relevant gate path**

Run: `pnpm nx run data:test:unit`  
Expected: PASS

Run: `pnpm nx run data:test:types`  
Expected: PASS

Run: `pnpm nx affected --target=test:types --base=origin/main`  
Expected: PASS for the affected workspace graph

- [ ] **Step 5: Commit the guardrails**

```bash
git add \
  packages/data/README.md \
  packages/data/package.json \
  packages/data/project.json \
  packages/data/src/runtime-safety.test.ts \
  docs/architecture/package-zielarchitektur.md \
  docs/architecture/package-gesamtuebersicht.md
git commit -m "chore: harden @sva/data package role"
```
