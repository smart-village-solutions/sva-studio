import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import type { ProjectRoot } from './changed-project-plan.ts';

const require = createRequire(import.meta.url);
const PROJECT_CONTAINERS = ['apps', 'packages', 'tooling'] as const;
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.nx', 'dist', 'build']);

const collectProjectRoots = (directoryPath: string, rootDir: string): ProjectRoot[] => {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const projectFilePath = path.join(directoryPath, 'project.json');
  if (fs.existsSync(projectFilePath)) {
    const project = JSON.parse(fs.readFileSync(projectFilePath, 'utf8')) as { name?: unknown };
    if (typeof project.name !== 'string' || project.name.trim().length === 0) {
      throw new Error(`Nx-Projektname fehlt in ${path.relative(rootDir, projectFilePath)}.`);
    }
    return [
      {
        name: project.name,
        root: path.relative(rootDir, directoryPath).replaceAll(path.sep, '/'),
      },
    ];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name))
    .flatMap((entry) => collectProjectRoots(path.join(directoryPath, entry.name), rootDir));
};

export const loadWorkspaceProjectRoots = (rootDir = process.cwd()): ProjectRoot[] =>
  PROJECT_CONTAINERS.flatMap((container) =>
    collectProjectRoots(path.join(rootDir, container), rootDir)
  ).sort((left, right) => left.name.localeCompare(right.name));

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
