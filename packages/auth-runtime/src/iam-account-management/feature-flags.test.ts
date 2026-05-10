import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('./shared-observability.js', () => ({
  logger: state.logger,
}));

describe('iam account management feature flags', () => {
  beforeEach(() => {
    state.logger.warn.mockReset();
    delete process.env.IAM_UI_ENABLED;
    delete process.env.IAM_ADMIN_ENABLED;
    delete process.env.IAM_BULK_ENABLED;
  });

  it('parses boolean flags from common truthy and falsy values', async () => {
    const { parseBooleanFlag } = await import('./feature-flags.js');

    expect(parseBooleanFlag(undefined, true)).toBe(true);
    expect(parseBooleanFlag(undefined, false)).toBe(false);
    expect(parseBooleanFlag(' true ', false)).toBe(true);
    expect(parseBooleanFlag('YES', false)).toBe(true);
    expect(parseBooleanFlag('on', false)).toBe(true);
    expect(parseBooleanFlag('1', false)).toBe(true);
    expect(parseBooleanFlag('false', true)).toBe(false);
    expect(parseBooleanFlag('0', true)).toBe(false);
  }, 15000);

  it('derives dependent feature flags from environment variables', async () => {
    const { getFeatureFlags } = await import('./feature-flags.js');

    expect(getFeatureFlags()).toEqual({
      iamUiEnabled: true,
      iamAdminEnabled: true,
      iamBulkEnabled: true,
    });

    process.env.IAM_UI_ENABLED = 'false';
    expect(getFeatureFlags()).toEqual({
      iamUiEnabled: false,
      iamAdminEnabled: false,
      iamBulkEnabled: false,
    });

    process.env.IAM_UI_ENABLED = 'true';
    process.env.IAM_ADMIN_ENABLED = 'false';
    expect(getFeatureFlags()).toEqual({
      iamUiEnabled: true,
      iamAdminEnabled: false,
      iamBulkEnabled: false,
    });
  });

  it('returns a typed api error and logs when a feature is disabled', async () => {
    const { ensureFeature } = await import('./feature-flags.js');

    const response = ensureFeature(
      {
        iamUiEnabled: true,
        iamAdminEnabled: true,
        iamBulkEnabled: false,
      },
      'iam_bulk',
      'request-1'
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'feature_disabled',
        message: 'Feature iam-bulk-enabled ist deaktiviert.',
      },
      requestId: 'request-1',
    });
    expect(state.logger.warn).toHaveBeenCalledWith('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature: 'iam_bulk',
      request_id: 'request-1',
    });
  });

  it('passes through when the requested feature is enabled', async () => {
    const { ensureFeature } = await import('./feature-flags.js');

    expect(
      ensureFeature(
        {
          iamUiEnabled: true,
          iamAdminEnabled: true,
          iamBulkEnabled: true,
        },
        'iam_admin',
        'request-2'
      )
    ).toBeNull();
    expect(state.logger.warn).not.toHaveBeenCalled();
  });
});
