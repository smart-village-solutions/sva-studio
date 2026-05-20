import { describe, expect, it } from 'vitest';

import { parsePublicWasteConfig } from './public-waste-config.server.js';

describe('public waste config', () => {
  it('rejects incomplete server-only config deterministically', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toThrow('public_waste_config_invalid');
  });
});
