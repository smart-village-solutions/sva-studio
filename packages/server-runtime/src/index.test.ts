import { describe, expect, it } from 'vitest';

import { createSdkLogger, serverRuntimePackageRoles, serverRuntimeVersion, toJsonErrorResponse } from './index.js';

describe('@sva/server-runtime package scaffold', () => {
  it('declares the target package role', () => {
    expect(serverRuntimeVersion).toBe('0.0.1');
    expect(serverRuntimePackageRoles).toContain('request-context');
  });

  it('exposes the server runtime facade', async () => {
    const logger = createSdkLogger({ component: 'server-runtime-test' });
    expect(logger).toHaveProperty('info');

    const response = toJsonErrorResponse(418, 'teapot');
    await expect(response.json()).resolves.toEqual({ error: 'teapot' });
    expect(response.status).toBe(418);
  });
});
