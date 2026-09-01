import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ssfPlugin } from '../src/index.js';

describe('SSF plugin metadata', () => {
  it('uses the approved namespace and has no premature UI or server contribution', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../plugin.manifest.json', import.meta.url), 'utf8')
    ) as Record<string, unknown>;

    expect(ssfPlugin).toMatchObject({
      id: 'ssf',
      routes: [],
      contentHistory: { mode: 'none', reasonCode: 'infrastructure_only' },
    });
    expect(manifest).toMatchObject({
      pluginId: 'ssf',
      manifestVersion: 1,
      extensionTier: 'admin',
      tenantActivationPolicy: 'automatic',
    });
    expect(manifest['entryPoints']).toEqual({ browser: './dist/index.js' });
  });
});
