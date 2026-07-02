import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const vitestConfigSource = readFileSync(resolve(__dirname, '..', 'vitest.config.ts'), 'utf8');

describe('data vitest coverage config', () => {
  it('inherits the shared coverage reporters required by the CI gate', () => {
    expect(vitestConfigSource).toContain("...sharedCoverageConfig");
    expect(vitestConfigSource).toContain("include: ['src/**/*.ts']");
  });

  it('excludes transitive workspace source packages from local data coverage', () => {
    expect(vitestConfigSource).toContain("const dataClientSourceGlob = resolve(__dirname, '../data-client/src/**');");
    expect(vitestConfigSource).toContain(
      "const dataRepositoriesSourceGlob = resolve(__dirname, '../data-repositories/src/**');"
    );
    expect(vitestConfigSource).toContain("exclude: [...localTestGlobs, dataClientSourceGlob, dataRepositoriesSourceGlob]");
  });
});
