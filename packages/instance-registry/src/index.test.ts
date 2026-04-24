import { describe, expect, it } from 'vitest';

import { instanceRegistryPackageRoles, instanceRegistryVersion } from './index.js';

describe('@sva/instance-registry package scaffold', () => {
  it('declares the target package role', () => {
    expect(instanceRegistryVersion).toBe('0.0.1');
    expect(instanceRegistryPackageRoles).toContain('provisioning');
  });
});
