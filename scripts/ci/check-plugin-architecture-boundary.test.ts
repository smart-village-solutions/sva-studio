import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectPluginArchitectureViolations,
  diffViolationsAgainstBaseline,
  parsePluginArchitectureBaseline,
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
});
