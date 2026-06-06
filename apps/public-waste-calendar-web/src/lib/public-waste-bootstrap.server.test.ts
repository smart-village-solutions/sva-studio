import { describe, expect, it } from 'vitest';

import {
  readPublicWasteBootstrapStateFromEnvironment,
  resolvePublicWasteBootstrapState,
} from './public-waste-bootstrap.server.js';

describe('public waste bootstrap', () => {
  it('returns a missing-config error state when no raw config is provided', () => {
    expect(resolvePublicWasteBootstrapState(undefined)).toMatchObject({
      status: 'error',
      reason: 'missing_config',
    });
  });

  it('returns an invalid-config error state when parsing fails', () => {
    expect(
      resolvePublicWasteBootstrapState({
        instanceId: '',
        supabase: { databaseUrl: '', schemaName: 'waste' },
      })
    ).toMatchObject({
      status: 'error',
      reason: 'invalid_config',
    });
  });

  it('prefers split PUBLIC_WASTE_* variables and only falls back to PUBLIC_WASTE_CONFIG_JSON when needed', () => {
    expect(
      readPublicWasteBootstrapStateFromEnvironment({
        env: {
          PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz-env',
          PUBLIC_WASTE_DATABASE_URL: 'postgres://env',
          PUBLIC_WASTE_SCHEMA_NAME: 'public-env',
          PUBLIC_WASTE_PDF_URL_TEMPLATE: 'https://env.invalid/{locationKey}/{year}.pdf',
        },
        rawConfigJson: JSON.stringify({
          instanceId: 'bb-prignitz-json',
          supabase: { databaseUrl: 'postgres://json', schemaName: 'public-json' },
          pdf: { urlTemplate: 'https://json.invalid/{locationKey}/{year}.pdf' },
        }),
      })
    ).toMatchObject({
      status: 'ready',
      config: {
        instanceId: 'bb-prignitz-env',
      },
    });

    expect(
      readPublicWasteBootstrapStateFromEnvironment({
        rawConfigJson: JSON.stringify({
          instanceId: 'bb-prignitz-json',
          supabase: { databaseUrl: 'postgres://json', schemaName: 'public-json' },
          pdf: { urlTemplate: 'https://json.invalid/{locationKey}/{year}.pdf' },
        }),
      })
    ).toMatchObject({
      status: 'ready',
      config: {
        instanceId: 'bb-prignitz-json',
      },
    });
  });
});
