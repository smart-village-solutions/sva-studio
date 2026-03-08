import { redirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { accountUiRouteGuards } from './account-ui.routes';

type Guard = (typeof accountUiRouteGuards)[keyof typeof accountUiRouteGuards];

const invoke = async (guard: Guard, roles: readonly string[] | null, href: string) => {
  return guard({
    context: {
      auth: {
        getUser: async () => (roles ? { roles } : null),
      },
    },
    location: { href },
  });
};

describe('accountUiRouteGuards', () => {
  it('redirects account route to login when unauthenticated', async () => {
    await expect(invoke(accountUiRouteGuards.account, null, '/account')).rejects.toMatchObject(
      redirect({ href: '/auth/login?redirect=%2Faccount' })
    );
  });

  it('allows account route for authenticated users', async () => {
    await expect(invoke(accountUiRouteGuards.account, ['editor'], '/account')).resolves.toBeUndefined();
  });

  it('allows admin users route for app_manager role', async () => {
    await expect(invoke(accountUiRouteGuards.adminUsers, ['app_manager'], '/admin/users')).resolves.toBeUndefined();
  });

  it('allows admin organizations route for app_manager role', async () => {
    await expect(invoke(accountUiRouteGuards.adminOrganizations, ['app_manager'], '/admin/organizations')).resolves.toBeUndefined();
  });

  it('redirects admin roles route when role is not system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminRoles, ['app_manager'], '/admin/roles')).rejects.toMatchObject(
      redirect({ href: '/?error=auth.insufficientRole' })
    );
  });

  it('allows admin roles route for system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminRoles, ['system_admin'], '/admin/roles')).resolves.toBeUndefined();
  });
});
