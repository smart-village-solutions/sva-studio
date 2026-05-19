import { describe, expect, it } from 'vitest';

import { resolvePublicWasteBootstrapState } from './public-waste-bootstrap.server.js';

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
});
