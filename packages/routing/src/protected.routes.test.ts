import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { createAdminRoute, createProtectedRoute } from './protected.routes';

const invokeGuard = async (
  guard: ReturnType<typeof createProtectedRoute>,
  user: { roles: readonly string[] } | null,
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
    const guard = createProtectedRoute();

    try {
      await invokeGuard(guard, null, '/admin/users?page=2');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/auth/login?redirect=%2Fadmin%2Fusers%3Fpage%3D2');
      }
    }
  });

  it('redirects authenticated users without required role', async () => {
    const guard = createProtectedRoute({ requiredRoles: ['system_admin'] });

    try {
      await invokeGuard(guard, { roles: ['editor'] }, '/admin/users');
      expect.fail('Expected redirect');
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      if (isRedirect(error)) {
        expect(error.options.href).toBe('/?error=auth.insufficientRole');
      }
    }
  });

  it('allows authenticated users with matching role', async () => {
    const guard = createProtectedRoute({ requiredRoles: ['system_admin'] });

    await expect(invokeGuard(guard, { roles: ['system_admin'] }, '/admin/users')).resolves.toBeUndefined();
  });

  it('uses default admin roles in createAdminRoute', async () => {
    const guard = createAdminRoute();

    await expect(invokeGuard(guard, { roles: ['app_manager'] }, '/admin/users')).resolves.toBeUndefined();
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
        expect(error.options.href).toBe('/auth/login?redirect=%2F');
      }
    }
  });
});
