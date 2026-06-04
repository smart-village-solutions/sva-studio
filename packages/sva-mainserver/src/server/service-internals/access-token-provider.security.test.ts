import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'access-token-provider.ts'), 'utf8');

describe('access token provider security contract', () => {
  it('derives credential fingerprints with scrypt instead of directly hashing secrets', () => {
    expect(source).toContain('scryptSync(');
    expect(source).not.toContain("createHmac('sha256'");
    expect(source).not.toContain("createHash('sha256')");
  });
});
