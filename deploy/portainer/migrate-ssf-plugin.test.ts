import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('SSF plugin migration runner', () => {
  it('passes secret-bearing SQL to psql through stdin instead of process arguments', () => {
    const source = readFileSync(new URL('./migrate-ssf-plugin.mjs', import.meta.url), 'utf8');

    expect(source).toContain("'--file=-'");
    expect(source).toContain('input: sql');
    expect(source).not.toMatch(/['"]-c['"],\s*sql/u);
  });

  it('reconciles distinct runtime and root login roles', () => {
    const source = readFileSync(new URL('./migrate-ssf-plugin.mjs', import.meta.url), 'utf8');

    expect(source).toContain('SSF_PLUGIN_RUNTIME_DB_PASSWORD');
    expect(source).toContain('ssf_plugin_tenant_runtime');
    expect(source).toContain('SSF_PLUGIN_ROOT_DB_PASSWORD');
    expect(source).toContain('ssf_plugin_root');
  });
});
