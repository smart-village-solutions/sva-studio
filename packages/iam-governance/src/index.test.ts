import { describe, expect, it } from 'vitest';

import { iamGovernancePackageRoles, iamGovernanceVersion } from './index.js';

describe('@sva/iam-governance package scaffold', () => {
  it('declares the target package role', () => {
    expect(iamGovernanceVersion).toBe('0.0.1');
    expect(iamGovernancePackageRoles).toContain('dsr');
  });
});
