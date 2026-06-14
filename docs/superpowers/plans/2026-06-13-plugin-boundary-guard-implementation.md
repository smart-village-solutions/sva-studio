# Plugin Boundary Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden `check:plugin-architecture-boundary` von einer blockierenden Brownfield-Baseline-Prüfung zu einem warn-only Plugin-Boundary-Guard mit detaillierter JSON-Allowlist und direkter Importkanten-Erfassung für `packages/plugin-*` weiterentwickeln.

**Architecture:** Die Umsetzung baut den vorhandenen Check weiter aus statt einen zweiten Parallel-Guard einzuführen. Die Kernänderungen liegen in der Boundary-Library: neue Allowlist-Struktur, direkte Importkanten mit `kind`, Normierung auf Package-/Subpath-Ebene und warn-only CLI-Verhalten. Danach werden CI-Einbindung und Dokumentation auf den neuen nicht blockierenden Rollout angepasst.

**Tech Stack:** TypeScript strict mode, tsx, Vitest, Nx, pnpm, Markdown-Doku, JSON-Konfiguration

---

## File Structure Map

### Boundary-Check und Konfiguration

- Create: `config/plugin-architecture-allowlist.json`
- Modify: `scripts/ci/check-plugin-architecture-boundary.ts`
- Modify: `scripts/ci/check-plugin-architecture-boundary.test.ts`
- Modify: `scripts/ci/plugin-architecture-boundary-lib.ts`
- Modify: `scripts/ci/plugin-architecture-boundary-baseline.ts`

### CI- und Root-Skript-Einbindung

- Modify: `package.json`
- Modify: `scripts/ci/run-pr-gate.ts`
- Modify: `scripts/ci/run-pr-gate.test.ts`

### Doku

- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/development/review-agent-governance.md`
- Modify: `docs/reports/plugin-architecture-boundary-baseline.md`

## Task 1: Allowlist-Modell von Markdown-Baseline auf JSON-Importkanten umstellen

**Files:**
- Create: `config/plugin-architecture-allowlist.json`
- Modify: `scripts/ci/plugin-architecture-boundary-baseline.ts`
- Test: `scripts/ci/check-plugin-architecture-boundary.test.ts`

- [ ] **Step 1: Write the failing test for JSON allowlist parsing**

Erweitere `scripts/ci/check-plugin-architecture-boundary.test.ts` um einen Test, der die neue JSON-Datei und das neue Eintragsformat erwartet:

```ts
it('parses the JSON allowlist with exact import-edge entries', () => {
  const allowlist = parsePluginArchitectureAllowlist([
    {
      plugin: 'waste-management',
      sourceFile: 'packages/plugin-waste-management/src/plugin.tsx',
      importSpecifier: '@sva/core/waste-management',
      resolvedTarget: '@sva/core/waste-management',
      kind: 'type',
      reason: 'Brownfield bridge until SDK contract exists',
      ticket: 'QUAL-123',
    },
  ]);

  expect(allowlist).toEqual([
    {
      plugin: 'waste-management',
      sourceFile: 'packages/plugin-waste-management/src/plugin.tsx',
      importSpecifier: '@sva/core/waste-management',
      resolvedTarget: '@sva/core/waste-management',
      kind: 'type',
      reason: 'Brownfield bridge until SDK contract exists',
      ticket: 'QUAL-123',
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "parses the JSON allowlist with exact import-edge entries"
```

Expected: FAIL because `parsePluginArchitectureAllowlist` and the new structure do not exist yet.

- [ ] **Step 3: Write the minimal allowlist parser and types**

Ersetze das reine Markdown-Baseline-Modell in `scripts/ci/plugin-architecture-boundary-baseline.ts` durch ein JSON-Allowlist-Modell mit exakten Importkanten:

```ts
export type PluginArchitectureImportKind = 'runtime' | 'type' | 'reexport';

export type PluginArchitectureAllowlistEntry = {
  plugin: string;
  sourceFile: string;
  importSpecifier: string;
  resolvedTarget: string;
  kind: PluginArchitectureImportKind;
  reason: string;
  ticket?: string;
};

export const parsePluginArchitectureAllowlist = (value: unknown): readonly PluginArchitectureAllowlistEntry[] => {
  if (!Array.isArray(value)) {
    throw new Error('Plugin architecture allowlist must be a JSON array.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Allowlist entry ${index} is not an object.`);
    }

    const candidate = entry as Record<string, unknown>;
    const { plugin, sourceFile, importSpecifier, resolvedTarget, kind, reason, ticket } = candidate;

    if (
      typeof plugin !== 'string' ||
      typeof sourceFile !== 'string' ||
      typeof importSpecifier !== 'string' ||
      typeof resolvedTarget !== 'string' ||
      typeof kind !== 'string' ||
      typeof reason !== 'string'
    ) {
      throw new Error(`Allowlist entry ${index} is incomplete or invalid.`);
    }

    if (kind !== 'runtime' && kind !== 'type' && kind !== 'reexport') {
      throw new Error(`Allowlist entry ${index} uses unknown kind ${String(kind)}.`);
    }

    if (ticket !== undefined && typeof ticket !== 'string') {
      throw new Error(`Allowlist entry ${index} has invalid ticket.`);
    }

    return {
      plugin,
      sourceFile,
      importSpecifier,
      resolvedTarget,
      kind,
      reason,
      ...(ticket ? { ticket } : {}),
    };
  });
};
```

Lege parallel die erste Datei `config/plugin-architecture-allowlist.json` an. Starte mit den aktuell tolerierten Waste-Management-Kanten, aber schon im neuen Format.

- [ ] **Step 4: Run tests to verify parsing passes**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "parses the JSON allowlist with exact import-edge entries"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  config/plugin-architecture-allowlist.json \
  scripts/ci/plugin-architecture-boundary-baseline.ts \
  scripts/ci/check-plugin-architecture-boundary.test.ts
git commit -m "refactor: switch plugin boundary baseline to json allowlist"
```

## Task 2: Direkte Importkanten mit `runtime`-, `type`- und `reexport`-Klassifikation erfassen

**Files:**
- Modify: `scripts/ci/plugin-architecture-boundary-lib.ts`
- Modify: `scripts/ci/check-plugin-architecture-boundary.test.ts`

- [ ] **Step 1: Write the failing tests for import kinds and normalized targets**

Ergaenze in `scripts/ci/check-plugin-architecture-boundary.test.ts` zwei gezielte Tests.

Test 1 fuer `import type` und Re-Export:

```ts
it('classifies runtime, type, and reexport workspace edges separately', async () => {
  const workspaceRoot = createTempWorkspace();
  createWorkspacePackage(workspaceRoot, 'core', {
    packageName: '@sva/core',
    sourceFiles: {
      'src/public-api.ts': 'export type CoreType = { value: string }; export const runtimeValue = true;\n',
    },
  });
  createPluginPackage(workspaceRoot, 'plugin-edge-kinds', {
    packageName: '@sva/plugin-edge-kinds',
    sourceFiles: {
      'src/index.ts': `
import type { CoreType } from '@sva/core';
import { runtimeValue } from '@sva/core';
export { runtimeValue as forwardedRuntime } from '@sva/core';
export type { CoreType as ForwardedCoreType } from '@sva/core';
export const pluginValue: CoreType | boolean = runtimeValue;
`,
    },
  });

  const violations = await collectPluginArchitectureViolations(workspaceRoot);

  expect(violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'type', resolvedTarget: '@sva/core' }),
      expect.objectContaining({ kind: 'runtime', resolvedTarget: '@sva/core' }),
      expect.objectContaining({ kind: 'reexport', resolvedTarget: '@sva/core' }),
    ])
  );
});
```

Test 2 fuer relative Package-/Subpath-Normierung:

```ts
it('normalizes relative imports to package or subpath targets instead of source file paths', async () => {
  const workspaceRoot = createTempWorkspace();
  createWorkspacePackage(workspaceRoot, 'core', {
    packageName: '@sva/core',
    sourceFiles: {
      'src/waste-management/static-content.ts': 'export const staticContent = true;\n',
    },
  });
  createPluginPackage(workspaceRoot, 'plugin-relative-subpath', {
    packageName: '@sva/plugin-relative-subpath',
    sourceFiles: {
      'src/index.ts': `export { staticContent } from '../../core/src/waste-management/static-content.js';\n`,
    },
  });

  const violations = await collectPluginArchitectureViolations(workspaceRoot);

  expect(violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'reexport',
        resolvedTarget: '@sva/core/waste-management',
      }),
    ])
  );
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "classifies runtime, type, and reexport workspace edges separately"
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "normalizes relative imports to package or subpath targets instead of source file paths"
```

Expected: FAIL because the current violation model has no `kind` or `resolvedTarget`.

- [ ] **Step 3: Write the minimal collector changes**

Erweitere `scripts/ci/plugin-architecture-boundary-lib.ts` so, dass der Collector nicht nur Specifier sammelt, sondern direkte Kanten mit Art und normiertem Ziel:

```ts
export type PluginArchitectureImportKind = 'runtime' | 'type' | 'reexport';

export type PluginArchitectureViolation = {
  packageName: string;
  relativePath: string;
  rule: PluginArchitectureViolationRule;
  subject: string;
  message: string;
  importSpecifier?: string;
  resolvedTarget?: string;
  kind?: PluginArchitectureImportKind;
};

type WorkspaceImportEdge = {
  importSpecifier: string;
  kind: PluginArchitectureImportKind;
};
```

Ersetze `getModuleSpecifiers(...)` durch einen AST-Leser, der Importkanten mit `kind` liefert:

```ts
const getWorkspaceImportEdges = (sourceFile: ts.SourceFile): readonly WorkspaceImportEdge[] => {
  const edges: WorkspaceImportEdge[] = [];

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      edges.push({
        importSpecifier: node.moduleSpecifier.text,
        kind: node.importClause?.isTypeOnly ? 'type' : 'runtime',
      });
      return;
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      edges.push({
        importSpecifier: node.moduleSpecifier.text,
        kind: 'reexport',
      });
    }
  });

  return edges;
};
```

Fuer relative Ziele fuehre eine Normierung auf Package-/Subpath-Ebene ein. Das Ziel fuer `../../core/src/waste-management/static-content.js` soll nicht `packages/core/src/...` bleiben, sondern z. B. `@sva/core/waste-management`.

Ein minimaler Startpunkt ist:

```ts
const normalizeWorkspaceResolvedTarget = (packageName: string, resolvedRelativePath: string): string => {
  if (!resolvedRelativePath.startsWith('packages/')) return resolvedRelativePath;

  const sourceMatch = resolvedRelativePath.match(/^packages\/([^/]+)\/src\/(.+)$/);
  if (!sourceMatch) return packageName;

  const [, , sourceSubpath] = sourceMatch;
  const cleaned = sourceSubpath
    .replace(/\/index\.[^.]+$/, '')
    .replace(/\.[^.]+$/, '');
  const segments = cleaned.split('/');
  segments.pop();
  return segments.length > 0 ? `${packageName}/${segments.join('/')}` : packageName;
};
```

- [ ] **Step 4: Run the focused tests and then the full boundary test file**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "classifies runtime, type, and reexport workspace edges separately"
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "normalizes relative imports to package or subpath targets instead of source file paths"
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  scripts/ci/plugin-architecture-boundary-lib.ts \
  scripts/ci/check-plugin-architecture-boundary.test.ts
git commit -m "feat: capture exact plugin boundary import edges"
```

## Task 3: CLI und Diff-Verhalten auf warn-only umstellen

**Files:**
- Modify: `scripts/ci/check-plugin-architecture-boundary.ts`
- Modify: `scripts/ci/plugin-architecture-boundary-baseline.ts`
- Modify: `package.json`
- Modify: `scripts/ci/run-pr-gate.ts`
- Modify: `scripts/ci/run-pr-gate.test.ts`
- Test: `scripts/ci/check-plugin-architecture-boundary.test.ts`

- [ ] **Step 1: Write the failing test for warn-only CLI behavior**

Ergaenze in `scripts/ci/check-plugin-architecture-boundary.test.ts` einen Test fuer den neuen Diff-Pfad:

```ts
it('keeps the check non-blocking while still reporting non-allowlisted violations', async () => {
  const workspaceRoot = createTempWorkspace();
  createWorkspacePackage(workspaceRoot, 'core', {
    packageName: '@sva/core',
    sourceFiles: {
      'src/public-api.ts': 'export const runtimeValue = true;\n',
    },
  });
  createPluginPackage(workspaceRoot, 'plugin-warning', {
    packageName: '@sva/plugin-warning',
    sourceFiles: {
      'src/index.ts': `import { runtimeValue } from '@sva/core'; export const pluginValue = runtimeValue;\n`,
    },
  });

  const result = await runPluginArchitectureBoundaryCheck(workspaceRoot, [], { mode: 'warn' });

  expect(result.exitCode).toBe(0);
  expect(result.violations).toHaveLength(1);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts -t "keeps the check non-blocking while still reporting non-allowlisted violations"
```

Expected: FAIL because `runPluginArchitectureBoundaryCheck` currently returns only blocking violations and the CLI exits with code 1.

- [ ] **Step 3: Write the minimal warn-only execution model**

Passe `scripts/ci/check-plugin-architecture-boundary.ts` und die Library auf ein Ergebnisobjekt um:

```ts
export type PluginArchitectureBoundaryCheckMode = 'warn' | 'strict';

export type PluginArchitectureBoundaryCheckResult = {
  mode: PluginArchitectureBoundaryCheckMode;
  violations: readonly PluginArchitectureViolation[];
  unallowlistedViolations: readonly PluginArchitectureViolation[];
  exitCode: 0 | 1;
};
```

Die CLI soll zunaechst standardmaessig warn-only laufen:

```ts
const result = await runPluginArchitectureBoundaryCheck(PROJECT_ROOT, DEFAULT_ALLOWLIST_PATH, { mode: 'warn' });

if (result.violations.length === 0) {
  return;
}

console.warn('Plugin-Boundary-Guard meldet nicht erlaubte interne Plugin-Kanten.');
for (const violation of result.unallowlistedViolations) {
  console.warn(`- [${violation.kind ?? 'unknown'}] ${violation.relativePath} -> ${violation.resolvedTarget ?? violation.subject}`);
}
process.exitCode = result.exitCode;
```

Passe `package.json` und `scripts/ci/run-pr-gate.ts` nicht auf einen neuen Skriptnamen an; halte `pnpm check:plugin-architecture-boundary` als festen Entry, aber mit warn-only Verhalten.

- [ ] **Step 4: Run the plugin-boundary tests and the PR-gate tests**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts scripts/ci/run-pr-gate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  scripts/ci/check-plugin-architecture-boundary.ts \
  scripts/ci/plugin-architecture-boundary-baseline.ts \
  package.json \
  scripts/ci/run-pr-gate.ts \
  scripts/ci/run-pr-gate.test.ts \
  scripts/ci/check-plugin-architecture-boundary.test.ts
git commit -m "refactor: make plugin boundary guard warn-only"
```

## Task 4: Doku und Governance auf den neuen Guard ausrichten

**Files:**
- Modify: `docs/guides/plugin-development.md`
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `docs/development/review-agent-governance.md`
- Modify: `docs/reports/plugin-architecture-boundary-baseline.md`

- [ ] **Step 1: Write the failing documentation assertions as a manual diff checklist**

Vor dem Edit die aktuellen Formulierungen suchen:

```bash
rg -n "plugin-architecture-boundary|Baseline|blockierend|docs/reports/plugin-architecture-boundary-baseline.md" \
  docs/guides/plugin-development.md \
  docs/architecture/package-zielarchitektur.md \
  docs/architecture/10-quality-requirements.md \
  docs/architecture/11-risks-and-technical-debt.md \
  docs/development/review-agent-governance.md
```

Expected: Treffer zeigen noch den blockierenden Baseline-Report unter `docs/reports/`.

- [ ] **Step 2: Update docs to the new guard contract**

Fuehre diese inhaltlichen Aenderungen durch:

```md
- `pnpm check:plugin-architecture-boundary` ist im ersten Rollout warn-only
- Scope bleibt `packages/plugin-*`
- geprueft werden direkte, relative, Runtime-, Type- und Re-Export-Kanten
- bekannte Altlasten stehen in `config/plugin-architecture-allowlist.json`
- `docs/reports/plugin-architecture-boundary-baseline.md` bleibt nur noch als Migrations-/Brownfield-Historie oder wird als Verweis auf die neue Allowlist umgebaut
- `@sva/plugin-sdk` und `@sva/studio-ui-react` sind die einzigen erlaubten internen Plugin-Einstiegspunkte
```

- [ ] **Step 3: Run the repository file-placement check**

Run:

```bash
pnpm check:file-placement
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add \
  docs/guides/plugin-development.md \
  docs/architecture/package-zielarchitektur.md \
  docs/architecture/10-quality-requirements.md \
  docs/architecture/11-risks-and-technical-debt.md \
  docs/development/review-agent-governance.md \
  docs/reports/plugin-architecture-boundary-baseline.md
git commit -m "docs: align plugin governance with boundary guard rollout"
```

## Task 5: Verify the smallest relevant gate path for the change

**Files:**
- Modify: `docs/superpowers/plans/2026-06-13-plugin-boundary-guard-implementation.md`

- [ ] **Step 1: Run unit tests for the changed CI scripts**

Run:

```bash
pnpm exec vitest run scripts/ci/check-plugin-architecture-boundary.test.ts scripts/ci/run-pr-gate.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the affected script typecheck**

Run:

```bash
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run the non-blocking boundary guard directly**

Run:

```bash
pnpm check:plugin-architecture-boundary
```

Expected: Exit code 0, warnings only when non-allowlisted plugin edges still exist.

- [ ] **Step 4: Run the smallest repo gate that covers this change**

Run:

```bash
pnpm check:file-placement
pnpm test:eslint
```

Expected: PASS. `test:eslint` may emit plugin-boundary warnings, but must stay green in the warn-only rollout.

- [ ] **Step 5: Commit verification-only plan status if needed**

```bash
git status --short
```

Expected: No unexpected files remain unstaged before any final integration commit.

## Spec Coverage Check

- Guard scope only `packages/plugin-*`: covered by Task 2 and Task 4
- Allowed boundaries only `@sva/plugin-sdk` and `@sva/studio-ui-react`: covered by Task 2 and Task 4
- Relative imports, `import`, `import type`, reexports: covered by Task 2
- Detailed JSON allowlist per import edge: covered by Task 1
- Package-/Subpath normalization: covered by Task 2
- Warn-only first rollout: covered by Task 3 and Task 4
- No automatic suggestions, reporting only: covered by Task 3

