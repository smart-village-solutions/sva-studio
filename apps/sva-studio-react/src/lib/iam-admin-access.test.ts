import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('iam-admin-access', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('evaluates feature flags with fallbacks and truthy values', async () => {
    const access = await import('./iam-admin-access');

    expect(access.isIamUiEnabled()).toBe(true);
    expect(access.isIamAdminEnabled()).toBe(true);
    expect(access.isIamBulkEnabled()).toBe(true);

    vi.stubEnv('VITE_IAM_UI_ENABLED', 'off');
    vi.stubEnv('VITE_IAM_ADMIN_ENABLED', 'yes');
    vi.stubEnv('VITE_IAM_BULK_ENABLED', '0');
    const updated = await import('./iam-admin-access');

    expect(updated.isIamUiEnabled()).toBe(false);
    expect(updated.isIamAdminEnabled()).toBe(false);
    expect(updated.isIamBulkEnabled()).toBe(false);
  });

  it('matches explicit admin capabilities, interface permissions and instance registry roles', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['custom_role', 'instance_registry_admin'],
      permissionActions: [
        'experimental.read',
        'iam.user.read',
        'iam.org.read',
        'iam.role.read',
        'iam.legalText.read',
        'iam.governance.read',
        'iam.monitoring.read',
        'integration.manage',
      ],
    };

    expect(access.hasUserAdminAccess(user)).toBe(true);
    expect(access.hasUserDeleteAccess(user)).toBe(false);
    expect(access.hasOrganizationAdminAccess(user)).toBe(true);
    expect(access.hasRoleAdminAccess(user)).toBe(true);
    expect(access.hasLegalTextAdminAccess(user)).toBe(true);
    expect(access.hasIamGovernanceAccess(user)).toBe(true);
    expect(access.hasMonitoringAccess(user)).toBe(true);
    expect(access.hasInterfacesAccess(user)).toBe(true);
    expect(access.hasExperimentalAccess(user)).toBe(true);
    expect(access.hasSystemAdminRole(user)).toBe(false);
    expect(access.hasPlatformInstanceAdminAccess(user)).toBe(true);
    expect(access.hasUserAdminAccess(null)).toBe(false);
  });

  it('does not treat the root-only platform role as tenant IAM admin access', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['instance_registry_admin'],
      permissionActions: [],
    };

    expect(access.hasUserAdminAccess(user)).toBe(false);
    expect(access.hasUserDeleteAccess(user)).toBe(false);
    expect(access.hasRoleAdminAccess(user)).toBe(false);
    expect(access.hasIamGovernanceAccess(user)).toBe(false);
    expect(access.hasPlatformInstanceAdminAccess(user)).toBe(true);
  });

  it('does not derive tenant IAM access from legacy role names without explicit permissions', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['app_manager'],
      permissionActions: ['news.read'],
    };

    expect(access.hasUserAdminAccess(user)).toBe(false);
    expect(access.hasUserDeleteAccess(user)).toBe(false);
    expect(access.hasOrganizationAdminAccess(user)).toBe(false);
    expect(access.hasRoleAdminAccess(user)).toBe(false);
    expect(access.hasLegalTextAdminAccess(user)).toBe(false);
    expect(access.hasIamGovernanceAccess(user)).toBe(false);
    expect(access.hasMonitoringAccess(user)).toBe(false);
  });

  it('does not derive interfaces access from legacy role names without integration.manage', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['interface_manager'],
      permissionActions: ['news.read'],
    };

    expect(access.hasInterfacesAccess(user)).toBe(false);
  });

  it('does not derive experimental access from legacy role names without experimental.read', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['app_manager'],
      permissionActions: ['app.read', 'cockpit.read'],
    };

    expect(access.hasExperimentalAccess(user)).toBe(false);
  });

  it('requires the explicit iam.accounts.delete permission for destructive user actions', async () => {
    const access = await import('./iam-admin-access');
    const deleteUser = {
      roles: ['system_admin'],
      permissionActions: ['iam.accounts.delete'],
    };
    const userAdminWithoutDelete = {
      roles: ['system_admin'],
      permissionActions: ['iam.user.read'],
    };

    expect(access.hasUserDeleteAccess(deleteUser)).toBe(true);
    expect(access.hasUserDeleteAccess(userAdminWithoutDelete)).toBe(false);
  });
});
