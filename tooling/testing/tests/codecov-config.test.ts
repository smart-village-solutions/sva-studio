import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readJson, type CoveragePolicy } from '../../../scripts/ci/coverage-gate.ts';

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

  it('keeps Codecov project and patch checks informational', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');
    const informationalFlags = parseCodecovInformationalFlags(codecovContents);

    expect(informationalFlags.project).toBe(true);
    expect(informationalFlags.patch).toBe(true);
  });
});
