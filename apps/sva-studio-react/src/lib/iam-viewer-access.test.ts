import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('iam-viewer-access', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('enables the cockpit when the explicit viewer flag is set', async () => {
    vi.doMock('./iam-admin-access', () => ({
      isIamAdminEnabled: () => false,
    }));
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'yes');

    const { isIamCockpitEnabled } = await import('./iam-viewer-access');

    expect(isIamCockpitEnabled()).toBe(true);
  });

  it('falls back to the admin feature flag when the viewer flag is not present', async () => {
    vi.doMock('./iam-admin-access', () => ({
      isIamAdminEnabled: () => true,
    }));

    const { isIamCockpitEnabled } = await import('./iam-viewer-access');

    expect(isIamCockpitEnabled()).toBe(true);
  });

  it('treats explicit false-like viewer flags as disabled and preserves compatibility aliases', async () => {
    vi.doMock('./iam-admin-access', () => ({
      isIamAdminEnabled: () => false,
    }));
    vi.stubEnv('VITE_ENABLE_IAM_ADMIN_VIEWER', 'off');

    const { isIamCockpitEnabled, isIamViewerEnabled, hasIamViewerAdminRole } = await import('./iam-viewer-access');

    expect(isIamCockpitEnabled()).toBe(false);
    expect(isIamViewerEnabled()).toBe(false);
    expect(hasIamViewerAdminRole({ permissionActions: ['iam.dsr.read'] })).toBe(true);
  });

  it('maps the allowed tabs to the harmonized role matrix', async () => {
    vi.doMock('./iam-admin-access', () => ({
      isIamAdminEnabled: () => false,
    }));

    const { getAllowedIamCockpitTabs, hasGovernanceComplianceExportRole, hasIamCockpitAccessRole } =
      await import('./iam-viewer-access');

    expect(getAllowedIamCockpitTabs({ permissionActions: ['iam.user.read', 'iam.governance.read', 'iam.dsr.read', 'iam.deletionRules.read'], instanceId: 'de-test' })).toEqual([
      'rights',
      'governance',
      'dsr',
      'deletion-rules',
    ]);
    expect(getAllowedIamCockpitTabs({ permissionActions: ['iam.user.read', 'iam.governance.read', 'iam.dsr.read'] })).toEqual([
      'rights',
      'governance',
      'dsr',
    ]);
    expect(getAllowedIamCockpitTabs({ permissionActions: ['iam.governance.read'] })).toEqual(['governance']);
    expect(getAllowedIamCockpitTabs({ permissionActions: ['iam.governance.read', 'iam.dsr.read'], instanceId: 'de-test' })).toEqual([
      'governance',
      'dsr',
    ]);
    expect(getAllowedIamCockpitTabs({ permissionActions: ['iam.user.read', 'iam.governance.read', 'iam.dsr.read', 'iam.deletionRules.read'], instanceId: 'de-test' })).toEqual([
      'rights',
      'governance',
      'dsr',
      'deletion-rules',
    ]);
    expect(getAllowedIamCockpitTabs({ permissionActions: ['news.read'] })).toEqual([]);
    expect(getAllowedIamCockpitTabs({ permissionActions: null })).toEqual([]);
    expect(getAllowedIamCockpitTabs(null)).toEqual([]);
    expect(hasGovernanceComplianceExportRole({ permissionActions: ['iam.governance.read'] })).toBe(false);
    expect(hasGovernanceComplianceExportRole({ permissionActions: ['iam.governance.export'] })).toBe(true);
    expect(hasIamCockpitAccessRole({ permissionActions: ['news.read'] })).toBe(false);
    expect(hasIamCockpitAccessRole({ permissionActions: ['iam.dsr.read'] })).toBe(true);
  });
});
