import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collectAppBoundaryViolations,
  reportAppBoundaryCheckResult,
  runAppBoundaryCheck,
} from './check-app-boundaries.ts';

const tempDirs: string[] = [];

const createTempWorkspace = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'app-boundaries-'));
  tempDirs.push(directory);
  return directory;
};

const writeSource = (workspaceRoot: string, relativePath: string, source: string): void => {
  const filePath = path.join(workspaceRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source, 'utf8');
};

describe('check-app-boundaries', () => {
  afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts app-internal relative imports and public package imports', async () => {
    const workspaceRoot = createTempWorkspace();
    writeSource(workspaceRoot, 'apps/app-one/src/internal.ts', 'export const internal = true;\n');
    writeSource(
      workspaceRoot,
      'apps/app-one/src/index.ts',
      `import { internal } from './internal.js';
import { packageValue } from '@sva/example';
export const value = internal && packageValue;
`
    );

    await expect(collectAppBoundaryViolations(workspaceRoot)).resolves.toEqual([]);
  });

  it('detects static, dynamic, require, import-equals and re-export imports into another app', async () => {
    const workspaceRoot = createTempWorkspace();
    writeSource(workspaceRoot, 'apps/app-two/src/shared.ts', 'export const shared = true;\n');
    writeSource(
      workspaceRoot,
      'apps/app-one/src/index.ts',
      `import type { SharedType } from '../../app-two/src/shared.js';
import { shared } from '../../app-two/src/shared.js';
export { shared as forwarded } from '../../app-two/src/shared.js';
export type { SharedType as ForwardedType } from '../../app-two/src/shared.js';
export const dynamic = () => import('../../app-two/src/shared.js');
export const required = require('../../app-two/src/shared.js');
import legacy = require('../../app-two/src/shared.js');
export const value: SharedType | import('../../app-two/src/shared.js').SharedType | boolean = shared;
`
    );

    const violations = await collectAppBoundaryViolations(workspaceRoot);

    expect(violations).toHaveLength(8);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceApp: 'app-one', targetApp: 'app-two', kind: 'type' }),
        expect.objectContaining({ sourceApp: 'app-one', targetApp: 'app-two', kind: 'runtime' }),
        expect.objectContaining({ sourceApp: 'app-one', targetApp: 'app-two', kind: 'reexport' }),
      ])
    );
  });

  it('supports workspace-relative app source specifiers', async () => {
    const workspaceRoot = createTempWorkspace();
    writeSource(
      workspaceRoot,
      'apps/app-one/src/index.ts',
      `export { shared } from 'apps/app-two/src/shared.js';\n`
    );

    await expect(collectAppBoundaryViolations(workspaceRoot)).resolves.toEqual([
      expect.objectContaining({
        sourceApp: 'app-one',
        targetApp: 'app-two',
        resolvedTarget: 'apps/app-two/src/shared.js',
      }),
    ]);
  });

  it('returns and reports a failing result with source and target app names', async () => {
    const workspaceRoot = createTempWorkspace();
    writeSource(
      workspaceRoot,
      'apps/app-one/src/index.ts',
      `import { shared } from '../../app-two/src/shared.js';\n`
    );
    const logger = { error: vi.fn() };

    const result = await runAppBoundaryCheck(workspaceRoot);

    expect(result.exitCode).toBe(1);
    expect(reportAppBoundaryCheckResult(result, logger)).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('app-one'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('app-two'));
  });
});
