import { describe, expect, it, vi } from 'vitest';

const createRouteMock = vi.fn((options: unknown) => options);

vi.mock('@tanstack/react-router', () => ({
  createRoute: (options: unknown) => createRouteMock(options),
}));

import { authRouteFactories, authRoutePaths } from './auth.routes';

describe('auth.routes', () => {
  it('exports unique auth route paths including critical endpoints', () => {
    expect(authRoutePaths.length).toBeGreaterThan(10);
    expect(new Set(authRoutePaths).size).toBe(authRoutePaths.length);

    expect(authRoutePaths).toContain('/auth/login');
    expect(authRoutePaths).toContain('/auth/logout');
    expect(authRoutePaths).toContain('/api/v1/iam/health/ready');
    expect(authRoutePaths).toContain('/api/v1/iam/health/live');
    expect(authRoutePaths).toContain('/iam/authorize');
    expect(authRoutePaths).toContain('/api/v1/iam/groups');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/roles');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/roles/$roleId');
    expect(authRoutePaths).toContain('/api/v1/iam/groups/$groupId/memberships');
    expect(authRoutePaths).toContain('/api/v1/iam/legal-texts');
    expect(authRoutePaths).toContain('/api/v1/iam/legal-texts/$legalTextVersionId');
    expect(authRoutePaths).toContain('/iam/admin/data-subject-rights/maintenance');
  });

  it('creates one factory per path and binds the parent root route', () => {
    const rootRoute = { id: 'root' };

    expect(authRouteFactories).toHaveLength(authRoutePaths.length);

    authRouteFactories.forEach((factory, index) => {
      const result = factory(rootRoute as never);
      const call = createRouteMock.mock.calls[index]?.[0] as {
        getParentRoute: () => unknown;
        path: string;
        component: () => unknown;
      };

      expect(call.path).toBe(authRoutePaths[index]);
      expect(call.getParentRoute()).toBe(rootRoute);
      expect(call.component()).toBeNull();
      expect(result).toBe(call);
    });
  });
});
