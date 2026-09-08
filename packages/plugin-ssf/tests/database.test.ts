import { describe, expect, it } from 'vitest';

import {
  closeSsfDatabasePoolForShutdown,
  readSsfDatabaseConfig,
  resolveSsfDatabasePool,
} from '../src/runtime.js';

describe('SSF database configuration', () => {
  it('is unavailable without an explicit plugin database URL', () => {
    expect(readSsfDatabaseConfig({})).toBeNull();
  });

  it('uses a bounded runtime pool without exposing additional configuration', () => {
    expect(
      readSsfDatabaseConfig({
        SVA_STUDIO_SSF_DATABASE_URL: ' postgresql://ssf-runtime:secret@postgres/ssf ',
      })
    ).toEqual({
      connectionString: 'postgresql://ssf-runtime:secret@postgres/ssf',
      applicationName: 'sva-studio-ssf-runtime',
      max: 10,
    });
  });

  it('shares one configured runtime pool until shutdown', async () => {
    const environment = {
      SVA_STUDIO_SSF_DATABASE_URL: 'postgresql://ssf-runtime:secret@postgres/ssf',
    };

    expect(resolveSsfDatabasePool(environment)).toBe(resolveSsfDatabasePool(environment));

    await closeSsfDatabasePoolForShutdown();
  });
});
