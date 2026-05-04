import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type PackageJson = {
  dependencies?: Record<string, string>;
};

const readPackageJson = (): PackageJson => {
  const filePath = resolve(import.meta.dirname, '..', 'package.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as PackageJson;
};

describe('iam-governance runtime dependencies', () => {
  it('declares postcss when sanitize-html is used at runtime', () => {
    const packageJson = readPackageJson();

    expect(packageJson.dependencies?.['sanitize-html']).toBeDefined();
    expect(packageJson.dependencies?.postcss).toBeDefined();
  });
});
