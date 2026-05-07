import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

import { createAdminRoute, createProtectedRoute } from './protected.routes';

const invokeGuard = async (
  guard: ReturnType<typeof createProtectedRoute>,
  user: { roles: readonly string[]; permissionActions?: readonly string[] } | null,
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

  it('redirects authenticated users without required role', async () => {
    const diagnostics = vi.fn();
    const guard = createProtectedRoute({
      diagnostics,
      route: '/admin/users',
      requiredRoles: ['tenant:alpha:system_admin'],
    });

    try {
      await invokeGuard(guard, { roles: ['editor'] }, '/admin/users');
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
      await invokeGuard(guard, { roles: ['editor'], permissionActions: ['events.read'] }, '/plugins/news');
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
      invokeGuard(guard, { roles: ['editor'], permissionActions: ['news.read', 'events.read'] }, '/plugins/news')
    ).resolves.toBeUndefined();
  });

  it('uses default admin roles in createAdminRoute', async () => {
    const guard = createAdminRoute({ route: '/admin/users' });

    await expect(invokeGuard(guard, { roles: ['app_manager'] }, '/admin/users')).resolves.toBeUndefined();
  });

  it('remains silent by default when no diagnostics hook is injected', async () => {
    const guard = createProtectedRoute({ route: '/admin/users' });

    await expect(invokeGuard(guard, { roles: ['system_admin'] }, '/admin/users')).resolves.toBeUndefined();
  });

  it('normalizes external redirect targets back to internal defaults', async () => {
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
        expect(error.options.href).toBe('/?auth=login&returnTo=%2F');
      }
    }
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
      await invokeGuard(guard, { roles: ['editor'] }, '/admin/users');
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
