import { describe, expect, it } from 'vitest';

import { serverRuntimePackageRoles, serverRuntimeVersion } from './index.js';

describe('@sva/server-runtime package scaffold', () => {
  it('declares the target package role', () => {
    expect(serverRuntimeVersion).toBe('0.0.1');
    expect(serverRuntimePackageRoles).toContain('request-context');
  });
});
