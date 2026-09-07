import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('SSF plugin migration runner', () => {
  it('passes secret-bearing SQL to psql through stdin instead of process arguments', () => {
    const source = readFileSync(new URL('./migrate-ssf-plugin.mjs', import.meta.url), 'utf8');

    expect(source).toContain("'--file=-'");
    expect(source).toContain('input: sql');
    expect(source).not.toMatch(/['"]-c['"],\s*sql/u);
  });
});
