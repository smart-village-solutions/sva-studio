import { describe, expect, it } from 'vitest';

import { authRoutePaths } from './routes.shared';

describe('authRoutePaths', () => {
  it('contains organization and context endpoints exactly once', () => {
    expect(authRoutePaths).toContain('/api/v1/iam/health/ready');
    expect(authRoutePaths).toContain('/api/v1/iam/health/live');
    expect(authRoutePaths).toContain('/api/v1/iam/groups');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/roles');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/roles/$roleId');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/memberships');
    expect(authRoutePaths).toContain('/api/v1/iam/instances');
    expect(authRoutePaths).toContain('/api/v1/iam/instances/$instanceId');
    expect(authRoutePaths).toContain('/api/v1/iam/instances/$instanceId/keycloak/status');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId/memberships');
    expect(authRoutePaths).toContain('/api/v1/iam/organizations/$organizationId/memberships/$accountId');
    expect(authRoutePaths).toContain('/api/v1/iam/me/context');
    expect(authRoutePaths).toContain('/api/v1/iam/users/sync-keycloak');
    expect(authRoutePaths).toContain('/api/v1/iam/groups');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId');

    expect(new Set(authRoutePaths).size).toBe(authRoutePaths.length);
  });
});
