import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { ProjectRoot } from './changed-project-plan.ts';

const require = createRequire(import.meta.url);

export const loadNxProjectRoots = (): ProjectRoot[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const output = execFileSync(process.execPath, [nxEntrypoint, 'graph', '--print'], {
    encoding: 'utf8',
    env: process.env,
  });
  const graph = JSON.parse(output) as {
    graph?: { nodes?: Record<string, { data?: { root?: string } }> };
  };

  return Object.entries(graph.graph?.nodes ?? {}).flatMap(([name, node]) =>
    node.data?.root ? [{ name, root: node.data.root }] : []
  );
};
