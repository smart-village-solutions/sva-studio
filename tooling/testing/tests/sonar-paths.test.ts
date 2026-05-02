import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { isSonarCoverageExcludedPath, readSonarCoverageExclusions } from '../../../scripts/ci/sonar-paths.ts';

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-paths-'));
  tempDirs.push(tempRoot);
  return tempRoot;
};

describe('sonar-paths', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads comma-separated sonar coverage exclusions from sonar-project.properties', () => {
    const rootDir = createTempRoot();
    fs.writeFileSync(
      path.join(rootDir, 'sonar-project.properties'),
      [
        '# comment should be ignored',
        'sonar.projectKey=smart-village-app_sva-studio',
        'sonar.coverage.exclusions=apps/sva-studio-react/src/routeTree.gen.ts, apps/sva-studio-react/src/routes/__debug/phase1-test/**',
      ].join('\n')
    );

    expect(readSonarCoverageExclusions(rootDir)).toEqual([
      'apps/sva-studio-react/src/routeTree.gen.ts',
      'apps/sva-studio-react/src/routes/__debug/phase1-test/**',
    ]);
  });

  it('matches exact files, recursive globs and normalizes platform separators', () => {
    const exclusions = [
      'apps/sva-studio-react/src/routeTree.gen.ts',
      'apps/sva-studio-react/src/routes/__debug/phase1-test/**',
    ];

    expect(isSonarCoverageExcludedPath('apps/sva-studio-react/src/routeTree.gen.ts', exclusions)).toBe(true);
    expect(
      isSonarCoverageExcludedPath(
        'apps\\sva-studio-react\\src\\routes\\__debug\\phase1-test\\-index.ts',
        exclusions
      )
    ).toBe(true);
    expect(isSonarCoverageExcludedPath('apps/sva-studio-react/src/routes/home.tsx', exclusions)).toBe(false);
  });
});
