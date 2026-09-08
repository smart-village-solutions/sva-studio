import { describe, expect, it, vi } from 'vitest';

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

  it('keeps a pool reachable when shutdown fails', async () => {
    const environment = {
      SVA_STUDIO_SSF_DATABASE_URL: 'postgresql://ssf-runtime:secret@postgres/ssf',
    };
    const pool = resolveSsfDatabasePool(environment);
    if (!pool) throw new Error('missing_ssf_database_pool');
    vi.spyOn(pool, 'end').mockRejectedValueOnce(new Error('shutdown_failed'));

    await expect(closeSsfDatabasePoolForShutdown()).rejects.toThrow('shutdown_failed');
    expect(resolveSsfDatabasePool(environment)).toBe(pool);

    await closeSsfDatabasePoolForShutdown();
  });
});
