import type { CompiledAccountInvitationTemplate } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadInstanceById: vi.fn(),
  resolveTenantAdminClientSecret: vi.fn(),
  getKeycloakTenantAdminClientConfigFromEnv: vi.fn((config: unknown) => config),
  constructClient: vi.fn(),
  client: {
    deleteRealmLocalizationText: vi.fn(),
    getRealmEmailTheme: vi.fn(),
    getRealmLocalizationTexts: vi.fn(),
    updateRealmLocalizationTexts: vi.fn(),
    updateRealmSettings: vi.fn(),
  },
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceById: state.loadInstanceById,
}));

vi.mock('../config-tenant-secret.js', () => ({
  resolveTenantAdminClientSecret: state.resolveTenantAdminClientSecret,
}));

vi.mock('../keycloak-admin-client.js', () => ({
  getKeycloakTenantAdminClientConfigFromEnv: state.getKeycloakTenantAdminClientConfigFromEnv,
  KeycloakAdminClient: vi.fn(function MockKeycloakAdminClient(config: unknown) {
    state.constructClient(config);
    return state.client;
  }),
}));

import {
  ACCOUNT_INVITATION_LOCALIZATION_KEYS,
  projectAccountInvitationTemplate,
  readAccountInvitationProjection,
} from './account-invitation-projection.js';

const expected: CompiledAccountInvitationTemplate = {
  executeActionsSubject: 'Willkommen',
  executeActionsBody: 'Passwort: {0}',
  executeActionsBodyHtml: '<p>Passwort: <a href="{0}">festlegen</a></p>',
};

describe('account invitation projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.loadInstanceById.mockResolvedValue({
      authRealm: 'demo',
      tenantAdminClient: { clientId: 'studio-tenant-admin' },
    });
    state.resolveTenantAdminClientSecret.mockResolvedValue({ secret: 'tenant-secret' });
    state.client.getRealmEmailTheme.mockResolvedValue('sva-kern2');
    state.client.getRealmLocalizationTexts.mockResolvedValue(expected);
    state.client.updateRealmLocalizationTexts.mockResolvedValue(undefined);
    state.client.updateRealmSettings.mockResolvedValue(undefined);
    state.client.deleteRealmLocalizationText.mockResolvedValue(undefined);
  });

  it('reports an exact realm projection as in sync', async () => {
    await expect(
      readAccountInvitationProjection({ instanceId: 'demo', authRealm: 'demo', expected })
    ).resolves.toMatchObject({ status: 'in_sync' });

    expect(state.constructClient).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: 'demo',
        clientId: 'studio-tenant-admin',
        clientSecret: 'tenant-secret',
      })
    );
  });

  it('reports changed realm messages as drifted', async () => {
    state.client.getRealmLocalizationTexts.mockResolvedValue({
      ...expected,
      executeActionsSubject: 'Geändert',
    });

    await expect(
      readAccountInvitationProjection({ instanceId: 'demo', authRealm: 'demo', expected })
    ).resolves.toMatchObject({ status: 'drifted' });
  });

  it('reports unavailable when tenant credentials are incomplete', async () => {
    state.resolveTenantAdminClientSecret.mockResolvedValue({ secret: '' });

    await expect(
      readAccountInvitationProjection({ instanceId: 'demo', authRealm: 'demo', expected })
    ).resolves.toMatchObject({ status: 'unavailable', errorCode: 'Error' });
    expect(state.constructClient).not.toHaveBeenCalled();
  });

  it('writes a custom template and verifies the exact readback', async () => {
    await expect(
      projectAccountInvitationTemplate({
        instanceId: 'demo',
        authRealm: 'demo',
        template: expected,
      })
    ).resolves.toBeUndefined();

    expect(state.client.updateRealmSettings).toHaveBeenCalledWith({ emailTheme: 'sva-kern2' });
    expect(state.client.updateRealmLocalizationTexts).toHaveBeenCalledWith('de', expected);
  });

  it('rejects a mismatching custom-template readback', async () => {
    state.client.getRealmEmailTheme.mockResolvedValue('base');

    await expect(
      projectAccountInvitationTemplate({
        instanceId: 'demo',
        authRealm: 'demo',
        template: expected,
      })
    ).rejects.toThrow('account_invitation_template_readback_mismatch');
  });

  it('removes all managed localization keys when resetting the template', async () => {
    state.client.getRealmLocalizationTexts.mockResolvedValue({ unrelated: 'bleibt erhalten' });

    await expect(
      projectAccountInvitationTemplate({ instanceId: 'demo', authRealm: 'demo', template: null })
    ).resolves.toBeUndefined();

    expect(state.client.deleteRealmLocalizationText).toHaveBeenCalledTimes(
      ACCOUNT_INVITATION_LOCALIZATION_KEYS.length
    );
    for (const key of ACCOUNT_INVITATION_LOCALIZATION_KEYS) {
      expect(state.client.deleteRealmLocalizationText).toHaveBeenCalledWith('de', key);
    }
  });

  it('rejects a reset when a managed localization key remains', async () => {
    state.client.getRealmLocalizationTexts.mockResolvedValue({
      executeActionsSubject: expected.executeActionsSubject,
    });

    await expect(
      projectAccountInvitationTemplate({ instanceId: 'demo', authRealm: 'demo', template: null })
    ).rejects.toThrow('account_invitation_template_reset_readback_mismatch');
  });
});
