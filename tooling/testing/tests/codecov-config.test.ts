import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readJson, type CoveragePolicy } from '../../../scripts/ci/coverage-gate.ts';

interface NxProjectConfig {
  name?: string;
  targets?: Record<string, unknown>;
}

function parseCodecovUnittestPaths(codecovContents: string): string[] {
  const lines = codecovContents.split('\n');
  const paths: string[] = [];
  let insideUnittests = false;
  let insidePaths = false;

  for (const line of lines) {
    if (/^\s{4}unittests:\s*$/.test(line)) {
      insideUnittests = true;
      insidePaths = false;
      continue;
    }

    if (insideUnittests && /^\s{6}paths:\s*$/.test(line)) {
      insidePaths = true;
      continue;
    }

    if (insidePaths) {
      const pathMatch = line.match(/^\s{8}-\s+(.+?)\s*$/);
      if (pathMatch) {
        paths.push(pathMatch[1]);
        continue;
      }

      if (/^\s{0,6}\S/.test(line)) {
        break;
      }
    }
  }

  return paths;
}

function parseCodecovInformationalFlags(codecovContents: string): Record<string, boolean> {
  const lines = codecovContents.split('\n');
  const informationalByStatus: Record<string, boolean> = {};
  let insideCoverage = false;
  let insideStatus = false;
  let currentStatusKey: string | null = null;
  let insideDefault = false;

  for (const line of lines) {
    if (/^coverage:\s*$/.test(line)) {
      insideCoverage = true;
      insideStatus = false;
      currentStatusKey = null;
      insideDefault = false;
      continue;
    }

    if (insideCoverage && /^[^\s]/.test(line) && !/^coverage:\s*$/.test(line)) {
      insideCoverage = false;
      insideStatus = false;
      currentStatusKey = null;
      insideDefault = false;
    }

    if (!insideCoverage) {
      continue;
    }

    if (/^\s{2}status:\s*$/.test(line)) {
      insideStatus = true;
      currentStatusKey = null;
      insideDefault = false;
      continue;
    }

    if (insideStatus && /^\s{2}\S/.test(line) && !/^\s{2}status:\s*$/.test(line)) {
      insideStatus = false;
      currentStatusKey = null;
      insideDefault = false;
    }

    if (!insideStatus) {
      continue;
    }

    const statusKeyMatch = line.match(/^\s{4}(project|patch):\s*$/);
    if (statusKeyMatch) {
      currentStatusKey = statusKeyMatch[1];
      insideDefault = false;
      continue;
    }

    if (/^\s{4}\S/.test(line) && !statusKeyMatch) {
      currentStatusKey = null;
      insideDefault = false;
    }

    if (!currentStatusKey) {
      continue;
    }

    if (/^\s{6}default:\s*$/.test(line)) {
      insideDefault = true;
      continue;
    }

    if (insideDefault && /^\s{6}\S/.test(line) && !/^\s{6}default:\s*$/.test(line)) {
      insideDefault = false;
    }

    if (!insideDefault) {
      continue;
    }

    const informationalMatch = line.match(/^\s{8}informational:\s+(true|false)\s*$/);
    if (informationalMatch) {
      informationalByStatus[currentStatusKey] = informationalMatch[1] === 'true';
    }
  }

  return informationalByStatus;
}

function loadWorkspaceCoverageProjects(rootDir: string): string[] {
  const projectRoots = ['apps', 'packages', 'tooling']
    .map((directory) => path.join(rootDir, directory))
    .filter((directory) => fs.existsSync(directory));

  const names: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.name !== 'project.json') {
        continue;
      }

      const project = readJson<NxProjectConfig>(entryPath);
      if (project.name && project.targets?.['test:coverage']) {
        names.push(project.name);
      }
    }
  };

  for (const projectRoot of projectRoots) {
    visit(projectRoot);
  }

  return names.sort((left, right) => left.localeCompare(right));
}

describe('codecov config', () => {
  it('does not include coverage-exempt projects in the unittests flag scope', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const policy = readJson<CoveragePolicy>(path.join(rootDir, 'tooling/testing/coverage-policy.json'));
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');
    const configuredPaths = parseCodecovUnittestPaths(codecovContents);

    for (const exemptProject of policy.exemptProjects) {
      expect(configuredPaths).not.toContain(`packages/${exemptProject}/`);
      expect(configuredPaths).not.toContain(`apps/${exemptProject}/`);
    }
  });

  it('includes all non-exempt coverage-tracked projects in the unittests flag scope', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const policy = readJson<CoveragePolicy>(path.join(rootDir, 'tooling/testing/coverage-policy.json'));
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');
    const configuredPaths = parseCodecovUnittestPaths(codecovContents);
    const exemptProjects = new Set(policy.exemptProjects);

    for (const projectName of Object.keys(policy.perProjectFloors)) {
      if (exemptProjects.has(projectName)) {
        continue;
      }

      const packagePath = `packages/${projectName}/`;
      const appPath = `apps/${projectName}/`;
      expect(configuredPaths.includes(packagePath) || configuredPaths.includes(appPath)).toBe(true);
    }
  });

  it('does not contain stale Codecov flag paths for non-existent projects', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const policy = readJson<CoveragePolicy>(path.join(rootDir, 'tooling/testing/coverage-policy.json'));
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');
    const configuredPaths = parseCodecovUnittestPaths(codecovContents);
    const expectedProjects = new Set(Object.keys(policy.perProjectFloors));

    for (const configuredPath of configuredPaths) {
      const projectName = configuredPath.replace(/^apps\//, '').replace(/^packages\//, '').replace(/\/$/, '');
      expect(expectedProjects.has(projectName)).toBe(true);
    }
  });

  it('tracks every non-exempt project with test:coverage in the coverage policy', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const policy = readJson<CoveragePolicy>(path.join(rootDir, 'tooling/testing/coverage-policy.json'));
    const exemptProjects = new Set(policy.exemptProjects);
    const trackedProjects = new Set(Object.keys(policy.perProjectFloors));

    for (const projectName of loadWorkspaceCoverageProjects(rootDir)) {
      if (exemptProjects.has(projectName)) {
        continue;
      }

      expect(trackedProjects.has(projectName)).toBe(true);
    }
  });

  it('keeps Codecov project and patch checks informational', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');
    const informationalFlags = parseCodecovInformationalFlags(codecovContents);

    expect(informationalFlags.project).toBe(true);
    expect(informationalFlags.patch).toBe(true);
  });
});
