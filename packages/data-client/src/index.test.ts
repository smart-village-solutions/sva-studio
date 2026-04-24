import { describe, expect, it } from 'vitest';

import { dataClientPackageRoles, dataClientVersion } from './index.js';

describe('@sva/data-client package scaffold', () => {
  it('declares the target package role', () => {
    expect(dataClientVersion).toBe('0.0.1');
    expect(dataClientPackageRoles).toContain('http-client');
  });
});
