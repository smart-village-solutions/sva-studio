import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeSonarSourcePath, prepareSonarLcov } from '../../../scripts/ci/prepare-sonar-lcov.ts';

const createTempRoot = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-sonar-lcov-'));

const writeCoverageReport = (rootDir: string, projectPath: string, contents: string): void => {
  const coverageDir = path.join(rootDir, projectPath, 'coverage');
  fs.mkdirSync(coverageDir, { recursive: true });
  fs.writeFileSync(path.join(coverageDir, 'lcov.info'), contents);
};

describe('prepare sonar lcov', () => {
  it('normalizes package-relative source paths to repository-relative paths', () => {
    const rootDir = createTempRoot();
    const projectRoot = path.join(rootDir, 'packages/auth-runtime');

    expect(normalizeSonarSourcePath(rootDir, projectRoot, 'src/index.ts')).toBe(
      'packages/auth-runtime/src/index.ts'
    );
  });

  it('normalizes cross-package source paths from a package coverage report', () => {
    const rootDir = createTempRoot();
    const projectRoot = path.join(rootDir, 'packages/data');

    expect(normalizeSonarSourcePath(rootDir, projectRoot, '../data-repositories/src/index.ts')).toBe(
      'packages/data-repositories/src/index.ts'
    );
  });

  it('writes a merged Sonar LCOV report for apps and packages', () => {
    const rootDir = createTempRoot();
    writeCoverageReport(
      rootDir,
      'apps/sva-studio-react',
      ['TN:', 'SF:src/styles.css', 'DA:1,1', 'end_of_record'].join('\n')
    );
    writeCoverageReport(
      rootDir,
      'packages/auth-runtime',
      ['TN:', 'SF:src/keycloak-user-attributes.ts', 'DA:32,1', 'end_of_record'].join('\n')
    );

    const result = prepareSonarLcov({ rootDir });
    const output = fs.readFileSync(path.join(rootDir, result.outputPath), 'utf8');

    expect(result).toEqual({
      outputPath: 'artifacts/sonar/lcov.info',
      reports: 2,
      sourceFiles: 2,
    });
    expect(output).toContain('SF:apps/sva-studio-react/src/styles.css');
    expect(output).toContain('SF:packages/auth-runtime/src/keycloak-user-attributes.ts');
  });
});
