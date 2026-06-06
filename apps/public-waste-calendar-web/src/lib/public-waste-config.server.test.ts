import { describe, expect, it } from 'vitest';

import {
  parsePublicWasteConfig,
  readPublicWasteConfigFromEnvironment,
} from './public-waste-config.server.js';

describe('public waste config', () => {
  it('rejects incomplete server-only config deterministically', () => {
    expect(() =>
      parsePublicWasteConfig({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toThrow('public_waste_config_invalid');
  });

  it('reads production config from split PUBLIC_WASTE_* environment variables', () => {
    expect(
      readPublicWasteConfigFromEnvironment({
        PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
        PUBLIC_WASTE_DATABASE_URL: 'postgres://example',
        PUBLIC_WASTE_SCHEMA_NAME: 'public',
        PUBLIC_WASTE_PDF_URL_TEMPLATE: 'https://example.invalid/{locationKey}/{year}.pdf',
      })
    ).toEqual({
      instanceId: 'bb-prignitz',
      supabase: {
        databaseUrl: 'postgres://example',
        schemaName: 'public',
      },
      pdf: {
        urlTemplate: 'https://example.invalid/{locationKey}/{year}.pdf',
      },
    });
  });
});
