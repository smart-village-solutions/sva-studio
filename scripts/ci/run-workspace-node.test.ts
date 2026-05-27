import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const scriptPath = path.join(workspaceRoot, 'scripts/ci/run-workspace-node.sh');
const requestedNodeVersion = readFileSync(path.join(workspaceRoot, '.nvmrc'), 'utf8').trim();

const tempDirs: string[] = [];

const makeExecutableNode = (filePath: string, marker: string) => {
  writeFileSync(
    filePath,
    `#!/usr/bin/env bash
echo "${marker}"
`,
    'utf8',
  );
  execFileSync('chmod', ['+x', filePath]);
};

describe('run-workspace-node.sh', () => {
  afterEach(() => {
    for (const dirPath of tempDirs.splice(0)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  });

  it('prefers the exact nvm version from .nvmrc before falling back to PATH', () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), 'run-workspace-node-home-'));
    tempDirs.push(tempHome);

    const nvmBinDir = path.join(tempHome, `.nvm/versions/node/v${requestedNodeVersion}/bin`);
    mkdirSync(nvmBinDir, { recursive: true });
    makeExecutableNode(path.join(nvmBinDir, 'node'), 'nvm-node');

    const pathBinDir = path.join(tempHome, 'bin');
    mkdirSync(pathBinDir, { recursive: true });
    makeExecutableNode(path.join(pathBinDir, 'node'), 'path-node');

    const output = execFileSync('bash', [scriptPath, '-p', 'process.version'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tempHome,
        PATH: `${pathBinDir}:${process.env.PATH ?? ''}`,
        NVM_BIN: '',
        SVA_WORKSPACE_NODE: '',
      },
    }).trim();

    expect(output).toBe('nvm-node');
  });
});
