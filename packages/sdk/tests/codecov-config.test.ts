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

  it('keeps Codecov project and patch checks informational', () => {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const codecovContents = fs.readFileSync(path.join(rootDir, 'codecov.yml'), 'utf8');

    expect(codecovContents).toMatch(/project:\s*\n\s+default:\s*\n(?:\s+.+\n)*?\s+informational:\s+true/);
    expect(codecovContents).toMatch(/patch:\s*\n\s+default:\s*\n(?:\s+.+\n)*?\s+informational:\s+true/);
  });
});
