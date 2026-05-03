import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository, createMediaRepository, dataRepositoriesPackageRoles, dataRepositoriesVersion } from './index.js';

describe('@sva/data-repositories package scaffold', () => {
  it('declares the target package role', () => {
    expect(dataRepositoriesVersion).toBe('0.0.1');
    expect(dataRepositoriesPackageRoles).toContain('postgres-repositories');
  });

  it('exposes repository factories through the target package edge', () => {
    expect(typeof createInstanceRegistryRepository).toBe('function');
    expect(typeof createMediaRepository).toBe('function');
  });
});
