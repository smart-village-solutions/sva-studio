import { redirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { accountUiRouteGuards, createAccountUiRouteGuards } from './account-ui.routes';

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
      redirect({ href: '/auth/login?returnTo=%2Faccount' })
    );
  });

  it('allows account route for authenticated users', async () => {
    await expect(invoke(accountUiRouteGuards.account, ['editor'], '/account')).resolves.toBeUndefined();
  });

  it('allows account privacy route for authenticated users', async () => {
    await expect(invoke(accountUiRouteGuards.accountPrivacy, ['editor'], '/account/privacy')).resolves.toBeUndefined();
  });

  it('allows content routes for editor role', async () => {
    await expect(invoke(accountUiRouteGuards.content, ['editor'], '/content')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentCreate, ['editor'], '/content/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentDetail, ['editor'], '/content/content-1')).resolves.toBeUndefined();
  });

  it('allows content routes for any authenticated user', async () => {
    await expect(invoke(accountUiRouteGuards.content, ['viewer'], '/content')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentCreate, ['viewer'], '/content/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentDetail, ['viewer'], '/content/content-1')).resolves.toBeUndefined();
  });

  it('allows admin users route for app_manager role', async () => {
    await expect(invoke(accountUiRouteGuards.adminUsers, ['app_manager'], '/admin/users')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminUserCreate, ['app_manager'], '/admin/users/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminUserDetail, ['app_manager'], '/admin/users/user-1')).resolves.toBeUndefined();
  });

  it('allows admin organizations route for app_manager role', async () => {
    await expect(invoke(accountUiRouteGuards.adminOrganizations, ['app_manager'], '/admin/organizations')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminOrganizationCreate, ['app_manager'], '/admin/organizations/new')
    ).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminOrganizationDetail, ['app_manager'], '/admin/organizations/org-1')
    ).resolves.toBeUndefined();
  });

  it('redirects admin roles route when role is not system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminRoles, ['app_manager'], '/admin/roles')).rejects.toMatchObject(
      redirect({ href: '/?error=auth.insufficientRole' })
    );
  });

  it('allows admin roles route for system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminRoles, ['system_admin'], '/admin/roles')).resolves.toBeUndefined();
  });

  it('allows admin groups route for system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminGroups, ['system_admin'], '/admin/groups')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminGroupCreate, ['system_admin'], '/admin/groups/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminGroupDetail, ['system_admin'], '/admin/groups/group-1')).resolves.toBeUndefined();
  });

  it('allows legal text routes for system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminLegalTexts, ['system_admin'], '/admin/legal-texts')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminLegalTextCreate, ['system_admin'], '/admin/legal-texts/new')
    ).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminLegalTextDetail, ['system_admin'], '/admin/legal-texts/legal-text-1')
    ).resolves.toBeUndefined();
  });

  it('allows admin iam route for compliance officer', async () => {
    await expect(invoke(accountUiRouteGuards.adminIam, ['compliance_officer'], '/admin/iam')).resolves.toBeUndefined();
  });

  it('allows admin iam route for security admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminIam, ['security_admin'], '/admin/iam')).resolves.toBeUndefined();
  });

  it('creates a fresh guard set when diagnostics are injected', () => {
    const diagnostics = () => undefined;
    const guards = createAccountUiRouteGuards(diagnostics);

    expect(guards.account).not.toBe(accountUiRouteGuards.account);
    expect(typeof guards.adminIam).toBe('function');
  });
});
