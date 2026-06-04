import { redirect } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

import { accountUiRouteGuards, createAccountUiRouteGuard, createAccountUiRouteGuards } from './account-ui.routes';

type Guard = (typeof accountUiRouteGuards)[keyof typeof accountUiRouteGuards];

const invoke = async (
  guard: Guard,
  user:
    | {
        roles: readonly string[];
        permissionActions?: readonly string[];
      }
    | null,
  href: string
) => {
  return guard({
    context: {
      auth: {
        getUser: async () => user,
      },
    },
    location: { href },
  });
};

describe('accountUiRouteGuards', () => {
  it('redirects account route to login when unauthenticated', async () => {
    await expect(invoke(accountUiRouteGuards.account, null, '/account')).rejects.toMatchObject(
      redirect({ href: '/?auth=login&returnTo=%2Faccount' })
    );
  });

  it('allows account route for authenticated users', async () => {
    await expect(invoke(accountUiRouteGuards.account, { roles: ['editor'] }, '/account')).resolves.toBeUndefined();
  });

  it('allows account privacy route for authenticated users', async () => {
    await expect(
      invoke(accountUiRouteGuards.accountPrivacy, { roles: ['editor'] }, '/account/privacy')
    ).resolves.toBeUndefined();
  });

  it('allows account privacy detail route for authenticated users', async () => {
    await expect(
      invoke(accountUiRouteGuards.accountPrivacyDetail, { roles: ['editor'] }, '/account/privacy/case-1')
    ).resolves.toBeUndefined();
  });

  it('allows account rules route for authenticated users', async () => {
    await expect(invoke(accountUiRouteGuards.accountRules, { roles: ['editor'] }, '/account/rules')).resolves.toBeUndefined();
  });

  it('allows modules route for authenticated users without admin roles', async () => {
    await expect(invoke(accountUiRouteGuards.modules, { roles: ['viewer'] }, '/modules')).resolves.toBeUndefined();
  });

  it('allows content routes for editor role', async () => {
    await expect(invoke(accountUiRouteGuards.content, { roles: ['editor'] }, '/admin/content')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentCreate, { roles: ['editor'] }, '/admin/content/new')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.contentDetail, { roles: ['editor'] }, '/admin/content/content-1')
    ).resolves.toBeUndefined();
  });

  it('allows content routes for any authenticated user', async () => {
    await expect(invoke(accountUiRouteGuards.content, { roles: ['viewer'] }, '/admin/content')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.contentCreate, { roles: ['viewer'] }, '/admin/content/new')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.contentDetail, { roles: ['viewer'] }, '/admin/content/content-1')
    ).resolves.toBeUndefined();
  });

  it('allows admin users route for custom permission grants without legacy roles', async () => {
    const user = { roles: ['custom_role'], permissionActions: ['iam.user.read', 'iam.user.write'] };
    await expect(invoke(accountUiRouteGuards.adminUsers, user, '/admin/users')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminUserCreate, user, '/admin/users/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminUserDetail, user, '/admin/users/user-1')).resolves.toBeUndefined();
  });

  it('allows admin organizations route for custom permission grants without legacy roles', async () => {
    const user = { roles: ['custom_role'], permissionActions: ['iam.org.read', 'iam.org.write'] };
    await expect(invoke(accountUiRouteGuards.adminOrganizations, user, '/admin/organizations')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminOrganizationCreate, user, '/admin/organizations/new')
    ).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminOrganizationDetail, user, '/admin/organizations/org-1')
    ).resolves.toBeUndefined();
  });

  it('redirects admin users route when IAM user permissions are missing', async () => {
    await expect(
      invoke(accountUiRouteGuards.adminUsers, { roles: ['app_manager'], permissionActions: ['news.read'] }, '/admin/users')
    ).rejects.toMatchObject(
      redirect({ href: '/?error=auth.insufficientRole' })
    );
  });

  it('allows admin roles route for custom permission grants without legacy roles', async () => {
    await expect(
      invoke(accountUiRouteGuards.adminRoles, { roles: ['custom_role'], permissionActions: ['iam.role.read'] }, '/admin/roles')
    ).resolves.toBeUndefined();
  });

  it('allows admin groups route for custom permission grants without legacy roles', async () => {
    const user = { roles: ['custom_role'], permissionActions: ['iam.role.read', 'iam.role.write'] };
    await expect(invoke(accountUiRouteGuards.adminGroups, user, '/admin/groups')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminGroupCreate, user, '/admin/groups/new')).resolves.toBeUndefined();
    await expect(invoke(accountUiRouteGuards.adminGroupDetail, user, '/admin/groups/group-1')).resolves.toBeUndefined();
  });

  it('allows legal text routes for system_admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminLegalTexts, { roles: ['system_admin'] }, '/admin/legal-texts')).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminLegalTextCreate, { roles: ['system_admin'] }, '/admin/legal-texts/new')
    ).resolves.toBeUndefined();
    await expect(
      invoke(accountUiRouteGuards.adminLegalTextDetail, { roles: ['system_admin'] }, '/admin/legal-texts/legal-text-1')
    ).resolves.toBeUndefined();
  });

  it('allows admin iam route for compliance officer', async () => {
    await expect(invoke(accountUiRouteGuards.adminIam, { roles: ['compliance_officer'] }, '/admin/iam')).resolves.toBeUndefined();
  });

  it('allows admin iam route for security admin', async () => {
    await expect(invoke(accountUiRouteGuards.adminIam, { roles: ['security_admin'] }, '/admin/iam')).resolves.toBeUndefined();
  });

  it('creates a fresh guard set when diagnostics are injected', () => {
    const diagnostics = () => undefined;
    const guards = createAccountUiRouteGuards(diagnostics);

    expect(guards.account).not.toBe(accountUiRouteGuards.account);
    expect(typeof guards.adminIam).toBe('function');
  });

  it('can override the diagnostics route for reused guards', async () => {
    const diagnostics = vi.fn();
    const guard = createAccountUiRouteGuard('account', diagnostics, '/media');

    await expect(invoke(guard, null, '/media')).rejects.toMatchObject(
      redirect({ href: '/?auth=login&returnTo=%2Fmedia' })
    );

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/media',
      reason: 'unauthenticated',
      redirect_target: '/',
    });
  });

  it('supports plugin-specific route diagnostics when content guards are reused', async () => {
    const diagnostics = vi.fn();
    const guard = createAccountUiRouteGuard('content', diagnostics, '/plugins/news');

    await expect(invoke(guard, null, '/plugins/news')).rejects.toMatchObject(
      redirect({ href: '/?auth=login&returnTo=%2Fplugins%2Fnews' })
    );

    expect(diagnostics).toHaveBeenCalledWith({
      level: 'info',
      event: 'routing.guard.access_denied',
      route: '/plugins/news',
      reason: 'unauthenticated',
      redirect_target: '/',
    });
  });
});
