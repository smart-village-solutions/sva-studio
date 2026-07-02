import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseProcessTable,
  resolveConflictingStudioServePids,
} from '../../../scripts/ci/cleanup-e2e-webserver-conflicts';

describe('cleanup e2e webserver conflicts', () => {
  it('parses ps output into typed process rows', () => {
    expect(
      parseProcessTable(`92218 92193 node /repo/node_modules/.bin/nx.js run sva-studio-react:serve
92242 92218 /opt/homebrew/bin/node /repo/node_modules/nx/dist/bin/run-executor.js`)
    ).toEqual([
      {
        pid: 92218,
        ppid: 92193,
        command: 'node /repo/node_modules/.bin/nx.js run sva-studio-react:serve',
      },
      {
        pid: 92242,
        ppid: 92218,
        command: '/opt/homebrew/bin/node /repo/node_modules/nx/dist/bin/run-executor.js',
      },
    ]);
  });

  it('resolves only workspace-owned stale studio serve processes from listener ancestors', () => {
    const workspaceRoot = path.resolve('/repo');
    const processes = [
      {
        pid: 500,
        ppid: 1,
        command: 'node /repo/node_modules/.bin/nx.js run sva-studio-react:serve',
      },
      {
        pid: 501,
        ppid: 500,
        command: '/opt/homebrew/bin/node /repo/node_modules/nx/dist/bin/run-executor.js',
      },
      {
        pid: 700,
        ppid: 1,
        command: 'node /other/workspace/node_modules/.bin/nx.js run sva-studio-react:serve',
      },
    ];

    expect(resolveConflictingStudioServePids([501, 700], processes, workspaceRoot)).toEqual([500, 501]);
  });
});
