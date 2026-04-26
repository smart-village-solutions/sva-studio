import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkServerPackageRuntime,
  collectDistRuntimeEntryPoints,
  collectRuntimeImportReferences,
  findStaticRuntimeViolations,
} from '../../../scripts/ci/check-server-package-runtime.ts';

const writeFile = (filePath: string, content: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

const createWorkspacePackage = (
  rootDir: string,
  input: {
    dependencies?: Record<string, string>;
    dirName: string;
    exports?: Record<string, unknown>;
    name: string;
    srcFiles?: Record<string, string>;
    distFiles?: Record<string, string>;
  }
): string => {
  const packageDir = path.join(rootDir, 'packages', input.dirName);
  writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: input.name,
        type: 'module',
        dependencies: input.dependencies ?? {},
        exports:
          input.exports ??
          {
            '.': {
              default: './dist/index.js',
            },
          },
      },
      null,
      2
    )
  );

  for (const [relativePath, content] of Object.entries(input.srcFiles ?? {})) {
    writeFile(path.join(packageDir, relativePath), content);
  }

  for (const [relativePath, content] of Object.entries(input.distFiles ?? {})) {
    writeFile(path.join(packageDir, relativePath), content);
  }

  return packageDir;
};

describe('check-server-package-runtime', () => {
  it('collects runtime imports and ignores type-only imports in static checks', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-guard-'));

    createWorkspacePackage(rootDir, {
      dirName: 'core',
      name: '@sva/core',
      srcFiles: {
        'src/index.ts': 'export const core = true;\n',
      },
      distFiles: {
        'dist/index.js': 'export const core = true;\n',
      },
    });

    createWorkspacePackage(rootDir, {
      dependencies: {
        '@sva/core': 'workspace:*',
      },
      dirName: 'data',
      name: '@sva/data',
      srcFiles: {
        'src/index.ts': [
          "import type { CoreThing } from '@sva/core';",
          "export * from './server';",
          'export const answer = 42 as const;',
        ].join('\n'),
      },
      distFiles: {
        'dist/index.js': 'export const answer = 42;\n',
      },
    });

    const filePath = path.join(rootDir, 'packages/data/src/index.ts');
    expect(collectRuntimeImportReferences(filePath)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isTypeOnly: true, specifier: '@sva/core' }),
        expect.objectContaining({ isTypeOnly: false, specifier: './server' }),
      ])
    );

    const violations = findStaticRuntimeViolations(rootDir, path.join(rootDir, 'packages/data'));
    expect(violations).toEqual([
      expect.objectContaining({
        filePath: 'packages/data/src/index.ts',
        message: expect.stringContaining('relative runtime export must use an explicit runtime extension'),
      }),
    ]);

    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('flags missing workspace runtime dependencies', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-deps-'));

    createWorkspacePackage(rootDir, {
      dirName: 'sdk',
      name: '@sva/sdk',
      srcFiles: {
        'src/index.ts': 'export const sdk = true;\n',
      },
      distFiles: {
        'dist/index.js': 'export const sdk = true;\n',
      },
    });

    createWorkspacePackage(rootDir, {
      dirName: 'data',
      name: '@sva/data',
      srcFiles: {
        'src/server.ts': "import { sdk } from '@sva/sdk';\nexport const data = sdk;\n",
      },
      distFiles: {
        'dist/index.js': 'export const data = true;\n',
      },
    });

    const violations = findStaticRuntimeViolations(rootDir, path.join(rootDir, 'packages/data'));
    expect(violations).toEqual([
      expect.objectContaining({
        filePath: 'packages/data/src/server.ts',
        message: 'runtime import @sva/sdk requires @sva/sdk in dependencies',
      }),
    ]);

    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('collects exported dist entry points and smoke-checks them', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-smoke-'));

    createWorkspacePackage(rootDir, {
      dirName: 'sdk',
      name: '@sva/sdk',
      srcFiles: {
        'src/index.ts': 'export const sdk = true;\n',
      },
      distFiles: {
        'dist/index.js': 'export const sdk = true;\n',
        'dist/server.js': "export const server = 'ok';\n",
      },
      exports: {
        '.': {
          default: './dist/index.js',
        },
        './server': {
          default: './dist/server.js',
        },
      },
    });

    const packageDir = path.join(rootDir, 'packages/sdk');
    expect(collectDistRuntimeEntryPoints(packageDir)).toEqual(['./dist/index.js', './dist/server.js']);
    await expect(
      checkServerPackageRuntime({
        rootDir,
        packageSelector: 'sdk',
        mode: 'all',
      })
    ).resolves.toEqual([]);

    createWorkspacePackage(rootDir, {
      dirName: 'auth',
      name: '@sva/auth',
      srcFiles: {
        'src/index.ts': "export * from './missing.js';\n",
      },
      distFiles: {
        'dist/index.js': "export * from './missing.js';\n",
      },
    });

    await expect(
      checkServerPackageRuntime({
        rootDir,
        packageSelector: 'auth',
        mode: 'smoke',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        filePath: 'packages/auth/dist/index.js',
        message: expect.stringContaining('dist runtime import failed'),
      }),
    ]);

    fs.rmSync(rootDir, { recursive: true, force: true });
  });
});
