import { describe, expect, it } from 'vitest';

import { authRoutePaths } from './routes.shared';

describe('authRoutePaths', () => {
  it('contains organization and context endpoints exactly once', () => {
    expect(authRoutePaths).toContain('/api/v1/iam/organizations');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId/memberships');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId/memberships/$accountId');
    expect(authRoutePaths).toContain('/api/v1/iam/me/context');
    expect(authRoutePaths).toContain('/api/v1/iam/users/sync-keycloak');

    expect(new Set(authRoutePaths).size).toBe(authRoutePaths.length);
  });
});
