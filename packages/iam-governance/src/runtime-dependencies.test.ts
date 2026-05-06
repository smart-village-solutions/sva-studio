import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type PackageJson = {
  dependencies?: Record<string, string>;
};

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const readPackageJson = (): PackageJson => {
  const filePath = resolve(currentDirectory, '..', 'package.json');
  return JSON.parse(readFileSync(filePath, 'utf8')) as PackageJson;
};

describe('iam-governance runtime dependencies', () => {
  it('declares postcss when sanitize-html is used at runtime', () => {
    const packageJson = readPackageJson();

    expect(packageJson.dependencies?.['sanitize-html']).toBeDefined();
    expect(packageJson.dependencies?.postcss).toBeDefined();
  });
});
