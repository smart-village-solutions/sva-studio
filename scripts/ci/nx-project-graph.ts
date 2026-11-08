import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import { coverageExecutesSameUnitCommand, type TestCommandTarget } from './affected-unit-plan.ts';
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

  return Object.entries(graph.graph?.nodes ?? {})
    .flatMap(([name, node]) => (node.data?.root ? [{ name, root: node.data.root }] : []))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const loadNxProjectsWithTarget = (
  target: string,
  base: string,
  head: string,
  full: boolean
): string[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const scopeArguments = full ? [] : ['--affected', '--base', base, '--head', head];
  const output = execFileSync(
    process.execPath,
    [nxEntrypoint, 'show', 'projects', `--withTarget=${target}`, ...scopeArguments, '--json'],
    { encoding: 'utf8', env: process.env }
  ).trim();
  return output ? (JSON.parse(output) as string[]) : [];
};

export const loadResidualUnitProjects = (): string[] => {
  const policy = JSON.parse(fs.readFileSync('tooling/testing/coverage-policy.json', 'utf8')) as {
    exemptProjects: string[];
  };
  const roots = loadNxProjectRoots();
  return loadNxProjectsWithTarget('test:unit', 'HEAD', 'HEAD', true).filter((project) => {
    const root = roots.find(({ name }) => name === project)?.root;
    if (!root) throw new Error(`Unit-Projektroot fehlt: ${project}`);
    const file = path.join(root, 'project.json');
    const targets = fs.existsSync(file)
      ? (
          JSON.parse(fs.readFileSync(file, 'utf8')) as {
            targets: Record<string, TestCommandTarget>;
          }
        ).targets
      : {};
    return (
      policy.exemptProjects.includes(project) ||
      !coverageExecutesSameUnitCommand(targets['test:unit'], targets['test:coverage'])
    );
  });
};
