import { describe, expect, it } from 'vitest';

import { authRoutePaths, authRuntimePackageRoles, authRuntimeVersion } from './index.js';
import { withAuthenticatedUser, withMediaRepository } from './server.js';

describe('@sva/auth-runtime package scaffold', () => {
  it('declares the target package role', () => {
    expect(authRuntimeVersion).toBe('0.0.1');
    expect(authRuntimePackageRoles).toContain('session');
  });

  it('exposes auth runtime route contracts through the target edge', () => {
    expect(authRoutePaths).toContain('/auth/login');
    expect(authRoutePaths).toContain('/auth/dev-login');
    expect(authRoutePaths).toContain('/auth/dev-logout');
    expect(authRoutePaths).toContain('/api/v1/iam/health/ready');
    expect(authRoutePaths).toContain('/api/v1/waste-management/master-data');
    expect(authRoutePaths).toContain('/api/v1/waste-management/history');
    expect(authRoutePaths).toContain('/api/v1/waste-management/scheduling');
    expect(authRoutePaths).toContain('/api/v1/waste-management/tours');
    expect(authRoutePaths).toContain('/api/v1/waste-management/settings');
  });

  it('exposes auth runtime server contracts through the target edge', () => {
    expect(typeof withAuthenticatedUser).toBe('function');
    expect(typeof withMediaRepository).toBe('function');
  });
});
