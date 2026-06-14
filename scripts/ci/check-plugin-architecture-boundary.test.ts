import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectPluginArchitectureViolations,
  diffViolationsAgainstBaseline,
  parsePluginArchitectureBaseline,
  reportPluginArchitectureBoundaryGuardResult,
  runPluginArchitectureBoundaryGuard,
  type PluginArchitectureBoundaryCheckResult,
  type PluginArchitectureViolation,
} from './check-plugin-architecture-boundary.ts';
import { parsePluginArchitectureAllowlist } from './plugin-architecture-boundary-baseline.ts';

const tempDirs: string[] = [];

const createTempWorkspace = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'plugin-architecture-boundary-'));
  tempDirs.push(directory);
  mkdirSync(path.join(directory, 'packages'), { recursive: true });
  mkdirSync(path.join(directory, 'docs/reports'), { recursive: true });
  return directory;
};

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeText = (filePath: string, content: string): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
};

const createPluginPackage = (
  workspaceRoot: string,
  packageDirectoryName: string,
  config: {
    packageName: string;
    dependencies?: Record<string, string>;
    sourceFiles: Record<string, string>;
  }
): void => {
  const packageRoot = path.join(workspaceRoot, 'packages', packageDirectoryName);
  writeJson(path.join(packageRoot, 'package.json'), {
    name: config.packageName,
    version: '0.0.1',
    private: true,
    dependencies: config.dependencies ?? {
      '@sva/plugin-sdk': 'workspace:*',
    },
  });

  for (const [relativePath, sourceCode] of Object.entries(config.sourceFiles)) {
    writeText(path.join(packageRoot, relativePath), sourceCode);
  }
};

const createWorkspacePackage = (
  workspaceRoot: string,
  packageDirectoryName: string,
  config: {
    packageName: string;
    sourceFiles: Record<string, string>;
  }
): void => {
  const packageRoot = path.join(workspaceRoot, 'packages', packageDirectoryName);
  writeJson(path.join(packageRoot, 'package.json'), {
    name: config.packageName,
    version: '0.0.1',
    private: true,
  });

  for (const [relativePath, sourceCode] of Object.entries(config.sourceFiles)) {
    writeText(path.join(packageRoot, relativePath), sourceCode);
  }
};

const sortViolations = (violations: readonly PluginArchitectureViolation[]): readonly PluginArchitectureViolation[] =>
  [...violations].sort((left, right) =>
    `${left.packageName}:${left.rule}:${left.subject}:${left.relativePath}`.localeCompare(
      `${right.packageName}:${right.rule}:${right.subject}:${right.relativePath}`
    )
  );

describe('check-plugin-architecture-boundary', () => {
  afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts standard-path plugins without violations', async () => {
    const workspaceRoot = createTempWorkspace();
    createPluginPackage(workspaceRoot, 'plugin-clean', {
      packageName: '@sva/plugin-clean',
      dependencies: {
        '@sva/plugin-sdk': 'workspace:*',
        '@sva/studio-ui-react': 'workspace:*',
      },
      sourceFiles: {
        'src/index.ts': `import type { PluginDefinition } from '@sva/plugin-sdk';
import type { AdminResourceDefinition } from '@sva/plugin-sdk/admin-resources';

export const pluginClean: PluginDefinition = {
  id: 'clean',
  displayName: 'Clean',
  routes: [],
  navigation: [],
  permissions: [],
  contentTypes: [],
  adminResources: [],
  auditEvents: [],
  translations: {},
};

export const adminResources: readonly AdminResourceDefinition[] = [];
`,
      },
    });

    await expect(collectPluginArchitectureViolations(workspaceRoot)).resolves.toEqual([]);
  });

  it('detects relative imports into other workspace packages and apps', async () => {
    const workspaceRoot = createTempWorkspace();
    createWorkspacePackage(workspaceRoot, 'core', {
      packageName: '@sva/core',
      sourceFiles: {
        'src/public-api.ts': 'export const authorize = () => true;\n',
      },
    });
    writeText(path.join(workspaceRoot, 'apps', 'sva-studio-react', 'src', 'app-shell.ts'), 'export const appShell = true;\n');
    createPluginPackage(workspaceRoot, 'plugin-relative-drift', {
      packageName: '@sva/plugin-relative-drift',
      sourceFiles: {
        'src/index.ts': `export { authorize } from '../../core/src/public-api.js';
export { appShell } from '../../../apps/sva-studio-react/src/app-shell.js';
`,
      },
    });

    const violations = await collectPluginArchitectureViolations(workspaceRoot);

    expect(violations).toHaveLength(2);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: '@sva/plugin-relative-drift',
          relativePath: path.posix.join('packages', 'plugin-relative-drift', 'src', 'index.ts'),
          rule: 'workspace-import',
          subject: '@sva/core',
        }),
        expect.objectContaining({
          packageName: '@sva/plugin-relative-drift',
          relativePath: path.posix.join('packages', 'plugin-relative-drift', 'src', 'index.ts'),
          rule: 'workspace-import',
          subject: path.posix.join('apps', 'sva-studio-react', 'src', 'app-shell.js'),
        }),
      ])
    );
  });

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
    const typeViolations = violations.filter((violation) => violation.kind === 'type' && violation.resolvedTarget === '@sva/core');
    const runtimeViolations = violations.filter((violation) => violation.kind === 'runtime' && violation.resolvedTarget === '@sva/core');
    const reexportViolations = violations.filter((violation) => violation.kind === 'reexport' && violation.resolvedTarget === '@sva/core');

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'type', resolvedTarget: '@sva/core' }),
        expect.objectContaining({ kind: 'runtime', resolvedTarget: '@sva/core' }),
        expect.objectContaining({ kind: 'reexport', resolvedTarget: '@sva/core' }),
      ])
    );
    expect(typeViolations).toHaveLength(2);
    expect(runtimeViolations).toHaveLength(1);
    expect(reexportViolations).toHaveLength(1);
  });

  it('normalizes relative imports to package or subpath targets instead of source file paths', async () => {
    const workspaceRoot = createTempWorkspace();
    createWorkspacePackage(workspaceRoot, 'core', {
      packageName: '@sva/core',
      sourceFiles: {
        'src/waste-management/index.ts': 'export const wasteManagement = true;\n',
        'src/waste-management/static-content.ts': 'export const staticContent = true;\n',
      },
    });
    createPluginPackage(workspaceRoot, 'plugin-relative-subpath', {
      packageName: '@sva/plugin-relative-subpath',
      sourceFiles: {
        'src/index.ts': `export { wasteManagement } from '../../core/src/waste-management/index.js';
export { staticContent } from '../../core/src/waste-management/static-content.js';\n`,
      },
    });

    const violations = await collectPluginArchitectureViolations(workspaceRoot);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          importSpecifier: '../../core/src/waste-management/index.js',
          kind: 'reexport',
          resolvedTarget: '@sva/core/waste-management',
        }),
        expect.objectContaining({
          importSpecifier: '../../core/src/waste-management/static-content.js',
          kind: 'reexport',
          resolvedTarget: '@sva/core/waste-management',
        }),
      ])
    );
  });

  it('detects workspace edges from require calls and dynamic imports', async () => {
    const workspaceRoot = createTempWorkspace();
    createWorkspacePackage(workspaceRoot, 'core', {
      packageName: '@sva/core',
      sourceFiles: {
        'src/admin-resources.ts': 'export const adminResources = true;\n',
        'src/public-api.ts': 'export const runtimeValue = true;\n',
      },
    });
    createPluginPackage(workspaceRoot, 'plugin-dynamic-edges', {
      packageName: '@sva/plugin-dynamic-edges',
      sourceFiles: {
        'src/index.ts': `
const adminResources = require('../../core/src/admin-resources.js');
export const loadRuntimeValue = async () => import('../../core/src/public-api.js');
export { adminResources };
`,
      },
    });

    const violations = await collectPluginArchitectureViolations(workspaceRoot);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          importSpecifier: '../../core/src/admin-resources.js',
          kind: 'runtime',
          resolvedTarget: '@sva/core/admin-resources',
        }),
        expect.objectContaining({
          importSpecifier: '../../core/src/public-api.js',
          kind: 'runtime',
          resolvedTarget: '@sva/core/public-api',
        }),
      ])
    );
  });

  it('normalizes top-level src files to package subpaths instead of the package root', async () => {
    const workspaceRoot = createTempWorkspace();
    createWorkspacePackage(workspaceRoot, 'core', {
      packageName: '@sva/core',
      sourceFiles: {
        'src/admin-resources.ts': 'export const adminResources = true;\n',
      },
    });
    createPluginPackage(workspaceRoot, 'plugin-top-level-subpath', {
      packageName: '@sva/plugin-top-level-subpath',
      sourceFiles: {
        'src/index.ts': `export { adminResources } from '../../core/src/admin-resources.js';\n`,
      },
    });

    const violations = await collectPluginArchitectureViolations(workspaceRoot);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          importSpecifier: '../../core/src/admin-resources.js',
          kind: 'reexport',
          resolvedTarget: '@sva/core/admin-resources',
        }),
      ])
    );
  });

  it('defaults the guard to warn-only while still reporting non-allowlisted violations', async () => {
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
        'src/index.ts': `import { runtimeValue } from '@sva/core';
export const pluginValue = runtimeValue;
`,
      },
    });

    const result = await runPluginArchitectureBoundaryGuard(workspaceRoot, []);

    expect(result.mode).toBe('warn');
    expect(result.exitCode).toBe(0);
    expect(result.violations).toHaveLength(1);
    expect(result.unallowlistedViolations).toHaveLength(1);
    expect(result.unallowlistedViolations).toEqual([
      expect.objectContaining({
        packageName: '@sva/plugin-warning',
        relativePath: path.posix.join('packages', 'plugin-warning', 'src', 'index.ts'),
        rule: 'workspace-import',
        subject: '@sva/core',
        kind: 'runtime',
        resolvedTarget: '@sva/core',
      }),
    ]);
  });

  it('suppresses warn-only CLI output when every violation is allowlisted', () => {
    const warnings: string[] = [];
    const logger = {
      warn: (message: string) => {
        warnings.push(message);
      },
    };
    const allowlistedResult: PluginArchitectureBoundaryCheckResult = {
      mode: 'warn',
      violations: [
        {
          packageName: '@sva/plugin-warning',
          relativePath: path.posix.join('packages', 'plugin-warning', 'src', 'index.ts'),
          rule: 'workspace-import',
          subject: '@sva/core',
          message: 'allowlisted import',
          kind: 'runtime',
          importSpecifier: '@sva/core',
          resolvedTarget: '@sva/core',
        },
      ],
      unallowlistedViolations: [],
      exitCode: 0,
    };

    expect(reportPluginArchitectureBoundaryGuardResult(allowlistedResult, logger)).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('detects forbidden workspace dependencies, imports and path signals', async () => {
    const workspaceRoot = createTempWorkspace();
    createPluginPackage(workspaceRoot, 'plugin-drift', {
      packageName: '@sva/plugin-drift',
      dependencies: {
        '@sva/plugin-sdk': 'workspace:*',
        '@sva/core': 'workspace:*',
      },
      sourceFiles: {
        'src/index.ts': `import { authorize } from '@sva/core';
export const pluginDrift = authorize;
`,
        'src/mainserver-news.ts': 'export const news = true;\n',
        'src/server.ts': 'export const server = true;\n',
      },
    });

    const violations = sortViolations(await collectPluginArchitectureViolations(workspaceRoot));

    expect(violations).toHaveLength(4);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: '@sva/plugin-drift',
          relativePath: path.posix.join('packages', 'plugin-drift', 'package.json'),
          rule: 'workspace-dependency',
          subject: '@sva/core',
        }),
        expect.objectContaining({
          packageName: '@sva/plugin-drift',
          relativePath: path.posix.join('packages', 'plugin-drift', 'src', 'index.ts'),
          rule: 'workspace-import',
          subject: '@sva/core',
        }),
        expect.objectContaining({
          packageName: '@sva/plugin-drift',
          relativePath: path.posix.join('packages', 'plugin-drift', 'src', 'mainserver-news.ts'),
          rule: 'forbidden-path-signal',
          subject: 'mainserver-',
        }),
        expect.objectContaining({
          packageName: '@sva/plugin-drift',
          relativePath: path.posix.join('packages', 'plugin-drift', 'src', 'server.ts'),
          rule: 'review-required-path-signal',
          subject: 'server.ts',
        }),
      ])
    );
  });

  it('anchors exact review-required file signals to the basename', async () => {
    const workspaceRoot = createTempWorkspace();
    createPluginPackage(workspaceRoot, 'plugin-path-signals', {
      packageName: '@sva/plugin-path-signals',
      sourceFiles: {
        'src/dev-server.ts': 'export const devServer = true;\n',
        'src/apiserver.ts': 'export const apiServer = true;\n',
        'src/plugin-operations.helper.ts': 'export const helper = true;\n',
      },
    });

    await expect(collectPluginArchitectureViolations(workspaceRoot)).resolves.toEqual([]);
  });

  it('parses the markdown baseline and filters documented brownfield violations', () => {
    const baseline = parsePluginArchitectureBaseline(`# Plugin Architecture Boundary Baseline

## Machine Readable Baseline

\`\`\`json
[
  {
    "packageName": "@sva/plugin-waste-management",
    "relativePath": "packages/plugin-waste-management/src/plugin.tsx",
    "rule": "workspace-import",
    "subject": "@sva/studio-module-iam",
    "owner": "studio-platform",
    "justification": "Brownfield-IAM-Kopplung",
    "removalChange": "refactor-studio-module-iam-public-contract"
  }
]
\`\`\`
`);

    expect(baseline).toEqual([
      {
        packageName: '@sva/plugin-waste-management',
        relativePath: 'packages/plugin-waste-management/src/plugin.tsx',
        rule: 'workspace-import',
        subject: '@sva/studio-module-iam',
        owner: 'studio-platform',
        justification: 'Brownfield-IAM-Kopplung',
        removalChange: 'refactor-studio-module-iam-public-contract',
      },
    ]);

    const unbaselined = diffViolationsAgainstBaseline(
      [
        {
          packageName: '@sva/plugin-waste-management',
          relativePath: 'packages/plugin-waste-management/src/plugin.tsx',
          rule: 'workspace-import',
          subject: '@sva/studio-module-iam',
          message: 'legacy import',
        },
        {
          packageName: '@sva/plugin-waste-management',
          relativePath: 'packages/plugin-waste-management/src/other.tsx',
          rule: 'workspace-import',
          subject: '@sva/studio-module-iam',
          message: 'new import',
        },
        {
          packageName: '@sva/plugin-waste-management',
          relativePath: 'packages/plugin-waste-management/package.json',
          rule: 'workspace-dependency',
          subject: '@sva/core',
          message: 'legacy dependency',
        },
      ],
      baseline
    );

    expect(unbaselined).toEqual([
      {
        packageName: '@sva/plugin-waste-management',
        relativePath: 'packages/plugin-waste-management/src/other.tsx',
        rule: 'workspace-import',
        subject: '@sva/studio-module-iam',
        message: 'new import',
      },
      {
        packageName: '@sva/plugin-waste-management',
        relativePath: 'packages/plugin-waste-management/package.json',
        rule: 'workspace-dependency',
        subject: '@sva/core',
        message: 'legacy dependency',
      },
    ]);
  });

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

  it('accepts JSON allowlist entries without a ticket', () => {
    const allowlist = parsePluginArchitectureAllowlist([
      {
        plugin: 'waste-management',
        sourceFile: 'packages/plugin-waste-management/src/plugin.tsx',
        importSpecifier: '@sva/core/waste-management',
        resolvedTarget: '@sva/core/waste-management',
        kind: 'type',
        reason: 'Brownfield bridge until SDK contract exists',
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
      },
    ]);
  });

  it('preserves ticket strings exactly when present', () => {
    const allowlist = parsePluginArchitectureAllowlist([
      {
        plugin: 'waste-management',
        sourceFile: 'packages/plugin-waste-management/src/plugin.tsx',
        importSpecifier: '@sva/core/waste-management',
        resolvedTarget: '@sva/core/waste-management',
        kind: 'type',
        reason: 'Brownfield bridge until SDK contract exists',
        ticket: '',
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
        ticket: '',
      },
    ]);
  });

  it('parses the file-based JSON allowlist smoke test', () => {
    const allowlistFile = readFileSync(path.join(process.cwd(), 'config', 'plugin-architecture-allowlist.json'), 'utf8');
    const parsed = JSON.parse(allowlistFile) as unknown;
    const allowlist = parsePluginArchitectureAllowlist(parsed);

    expect(allowlist.length).toBeGreaterThan(0);
    expect(allowlist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plugin: expect.any(String),
          sourceFile: expect.any(String),
          importSpecifier: expect.any(String),
          resolvedTarget: expect.any(String),
          kind: expect.stringMatching(/^(runtime|type|reexport)$/),
          reason: expect.any(String),
        }),
      ])
    );
  });
});
