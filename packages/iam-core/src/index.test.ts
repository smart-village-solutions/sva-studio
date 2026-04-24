import { describe, expect, it } from 'vitest';

import { iamCorePackageRoles, iamCoreVersion } from './index.js';

describe('@sva/iam-core package scaffold', () => {
  it('declares the target package role', () => {
    expect(iamCoreVersion).toBe('0.0.1');
    expect(iamCorePackageRoles).toContain('authorization-contracts');
  });
});
