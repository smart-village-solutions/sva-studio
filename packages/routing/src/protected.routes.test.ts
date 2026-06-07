import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

import { createAdminRoute, createProtectedRoute } from './protected.routes';

const invokeGuard = async (
  guard: ReturnType<typeof createProtectedRoute>,
  user:
    | {
        roles: readonly string[];
        permissionActions?: readonly string[];
        permissionStatus?: 'ok' | 'degraded';
      }
    | null,
  href: string
) =>
  guard({
    context: {
      auth: {
        getUser: () => user,
      },
    },
    location: { href },
  });

describe('protected routes', () => {
  it('redirects unauthenticated users to login with return URL', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({ diagnostics, route: '/admin/users/$userId' });

    try {
      await invokeGuard(guard, null, '/admin/users?page=2');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?auth=login&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/users/$userId',
      reason: 'unauthenticated',
      redirect_target: '/',
    });
  });

  it('keeps returnTo when the router supplies an absolute current URL', async () => {
    const guard = createProtectedRoute({ route: '/admin/users' });

    try {
      await invokeGuard(guard, null, 'http://127.0.0.1:4173/admin/users?page=2');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?auth=login&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');
      }
    }
  });

  it('redirects authenticated users without required role', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/admin/users',
      requiredRoles: ['tenant:alpha:system_admin'],
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'] }, '/admin/users');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/users',
      reason: 'insufficient-role',
      redirect_target: '/',
      required_roles: ['system_admin'],
    });
  });

  it('allows authenticated users with matching role', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({ diagnostics, requiredRoles: ['system_admin'], route: '/admin/users' });

    await expect(invokeGuard(guard, { roles: ['system_admin'] }, '/admin/users')).resolves.toBeUndefined();
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('redirects authenticated users without required permission', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/plugins/news',
      requiredPermissions: ['news.read'],
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['events.read'] }, '/plugins/news');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/plugins/news',
      reason: 'insufficient-permission',
      redirect_target: '/',
      required_permissions: ['news.read'],
    });
  });

  it('treats missing permission snapshots as insufficient permission for required permissions', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/plugins/news',
      requiredPermissions: ['news.read'],
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'] }, '/plugins/news');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/plugins/news',
      reason: 'insufficient-permission',
      redirect_target: '/',
      required_permissions: ['news.read'],
    });
  });

  it('allows authenticated users with required permission', async () => {
    const guard = createProtectedRoute({ route: '/plugins/news', requiredPermissions: ['news.read'] });

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['news.read', 'events.read'] }, '/plugins/news')
    ).resolves.toBeUndefined();
  });

  it('keeps degraded permission snapshots routable when the required permission is present', async () => {
    const guard = createProtectedRoute({ route: '/plugins/news', requiredPermissions: ['news.read'] });

    await expect(
      invokeGuard(
        guard,
        { roles: ['custom_role'], permissionActions: ['news.read'], permissionStatus: 'degraded' },
        '/plugins/news'
      )
    ).resolves.toBeUndefined();
  });

  it('uses explicit admin permissions in createAdminRoute', async () => {
    const guard = createAdminRoute({ route: '/admin/users', requiredPermissions: ['iam.user.read'] });

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['iam.user.read'] }, '/admin/users')
    ).resolves.toBeUndefined();
    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['news.read'] }, '/admin/users')
    ).rejects.toMatchObject(
      expect.objectContaining({
        options: expect.objectContaining({ href: '/?error=auth.insufficientRole' }),
      })
    );
  });

  it('allows routes when any alternative permission matches', async () => {
    const guard = createProtectedRoute({
      route: '/admin/iam',
      requiredAnyPermissions: ['iam.governance.read', 'iam.dsr.read'],
    });

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['iam.dsr.read'] }, '/admin/iam')
    ).resolves.toBeUndefined();

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['news.read'] }, '/admin/iam')
    ).rejects.toMatchObject(
      expect.objectContaining({
        options: expect.objectContaining({ href: '/?error=auth.insufficientRole' }),
      })
    );
  });

  it('treats missing permission snapshots as insufficient access for alternative permissions', async () => {
    const guard = createProtectedRoute({
      route: '/admin/iam',
      requiredAnyPermissions: ['iam.governance.read', 'iam.dsr.read'],
    });

    await expect(invokeGuard(guard, { roles: ['custom_role'] }, '/admin/iam')).rejects.toMatchObject(
      expect.objectContaining({
        options: expect.objectContaining({ href: '/?error=auth.insufficientRole' }),
      })
    );
  });

  it('allows routes when either an alternative permission or role matches', async () => {
    const guard = createProtectedRoute({
      route: '/admin/roles',
      requiredAnyPermissions: ['iam.role.read'],
      requiredAnyRoles: ['instance_registry_admin'],
    });

    await expect(
      invokeGuard(guard, { roles: ['instance_registry_admin'], permissionActions: [] }, '/admin/roles')
    ).resolves.toBeUndefined();

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['iam.role.read'] }, '/admin/roles')
    ).resolves.toBeUndefined();

    await expect(
      invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['news.read'] }, '/admin/roles')
    ).rejects.toMatchObject(
      expect.objectContaining({
        options: expect.objectContaining({ href: '/?error=auth.insufficientRole' }),
      })
    );
  });

  it('reports insufficient-role when only alternative roles are accepted', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/admin/roles',
      requiredAnyRoles: ['instance_registry_admin'],
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'], permissionActions: ['news.read'] }, '/admin/roles');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/roles',
      reason: 'insufficient-role',
      redirect_target: '/',
      required_roles: ['instance_registry_admin'],
    });
  });

  it('remains silent by default when no diagnostics hook is injected', async () => {
    const guard = createProtectedRoute({ route: '/admin/users' });

    await expect(invokeGuard(guard, { roles: ['system_admin'] }, '/admin/users')).resolves.toBeUndefined();
  });

  it('strips origins from absolute return targets without leaking external hosts', async () => {
    const guard = createProtectedRoute({
      loginPath: 'https://evil.example/login',
      fallbackPath: 'https://evil.example/fallback',
    });

    try {
      await invokeGuard(guard, null, 'https://evil.example/admin');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?auth=login&returnTo=%2Fadmin');
      }
    }
  });

  it('fails closed for external fallback paths on insufficient-role redirects and diagnostics', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/admin/users',
      requiredRoles: ['system_admin'],
      fallbackPath: 'https://evil.example/forbidden?x=1#hash',
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'] }, '/admin/users');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/admin/users',
      reason: 'insufficient-role',
      redirect_target: '/',
      required_roles: ['system_admin'],
    });
  });

  it('skips diagnostics when no explicit route is provided at runtime', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({ diagnostics } as never);

    try {
      await invokeGuard(guard, null, '/admin/users');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
    }

    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('skips insufficient-role diagnostics when no explicit route is provided at runtime', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      requiredRoles: ['system_admin'],
    });

    try {
      await invokeGuard(guard, { roles: ['custom_role'] }, '/admin/users');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }

    expect(diagnostics).not.toHaveBeenCalled();
  });
});
