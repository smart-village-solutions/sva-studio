import { describe, expect, it } from 'vitest';

import { authRuntimePackageRoles, authRuntimeVersion } from './index.js';

describe('@sva/auth-runtime package scaffold', () => {
  it('declares the target package role', () => {
    expect(authRuntimeVersion).toBe('0.0.1');
    expect(authRuntimePackageRoles).toContain('session');
  });
});
