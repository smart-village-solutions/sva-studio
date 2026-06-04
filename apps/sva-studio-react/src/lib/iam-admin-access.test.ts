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

  it('matches admin, interface permissions and instance registry roles', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['custom_role', 'instance_registry_admin'],
      permissionActions: ['iam.user.read', 'integration.manage'],
    };

    expect(access.hasIamAdminRole(user)).toBe(true);
    expect(access.hasInterfacesAccessRole(user)).toBe(true);
    expect(access.hasSystemAdminRole(user)).toBe(false);
    expect(access.hasInstanceRegistryAdminRole(user)).toBe(true);
    expect(access.hasIamAdminRole(null)).toBe(false);
  });

  it('does not treat the root-only platform role as tenant IAM admin access', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['instance_registry_admin'],
      permissionActions: [],
    };

    expect(access.hasIamAdminRole(user)).toBe(false);
    expect(access.hasInstanceRegistryAdminRole(user)).toBe(true);
  });

  it('does not derive tenant IAM admin access from legacy role names without IAM permissions', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['app_manager'],
      permissionActions: ['news.read'],
    };

    expect(access.hasIamAdminRole(user)).toBe(false);
  });

  it('does not derive interfaces access from legacy role names without integration.manage', async () => {
    const access = await import('./iam-admin-access');
    const user = {
      roles: ['interface_manager'],
      permissionActions: ['news.read'],
    };

    expect(access.hasInterfacesAccessRole(user)).toBe(false);
  });
});
