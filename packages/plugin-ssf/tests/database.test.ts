import { describe, expect, it } from 'vitest';

import { readSsfDatabaseConfig } from '../src/runtime.js';

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
});
