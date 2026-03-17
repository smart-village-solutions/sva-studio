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
    expect(hasIamViewerAdminRole({ roles: ['support_admin'] })).toBe(true);
  });

  it('maps the allowed tabs to the harmonized role matrix', async () => {
    vi.doMock('./iam-admin-access', () => ({
      isIamAdminEnabled: () => false,
    }));

    const { getAllowedIamCockpitTabs, hasIamCockpitAccessRole } = await import('./iam-viewer-access');

    expect(getAllowedIamCockpitTabs({ roles: ['support_admin'] })).toEqual(['rights', 'governance', 'dsr']);
    expect(getAllowedIamCockpitTabs({ roles: ['admin'] })).toEqual(['rights', 'governance', 'dsr']);
    expect(getAllowedIamCockpitTabs({ roles: ['security_admin'] })).toEqual(['governance']);
    expect(getAllowedIamCockpitTabs({ roles: ['compliance_officer'] })).toEqual(['governance']);
    expect(getAllowedIamCockpitTabs({ roles: ['iam_admin', 'security_admin'] })).toEqual(['rights', 'governance', 'dsr']);
    expect(getAllowedIamCockpitTabs({ roles: ['editor'] })).toEqual([]);
    expect(getAllowedIamCockpitTabs({ roles: null })).toEqual([]);
    expect(getAllowedIamCockpitTabs(null)).toEqual([]);
    expect(hasIamCockpitAccessRole({ roles: ['editor'] })).toBe(false);
    expect(hasIamCockpitAccessRole({ roles: ['iam_admin'] })).toBe(true);
  });
});
