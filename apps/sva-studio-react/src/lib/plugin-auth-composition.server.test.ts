import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createContribution: vi.fn(() => vi.fn()),
  readLoginRequirement: vi.fn(() => null),
}));

vi.mock('@sva/plugin-ssf/runtime', () => ({
  createSsfAccountCreateContribution: state.createContribution,
}));
vi.mock('@sva/plugin-ssf/provisioning', () => ({
  SSF_TENANT_OIDC_CLIENT_REQUIREMENT: { pluginId: 'ssf', clientId: 'ssf' },
  readSsfLoginClientRequirement: state.readLoginRequirement,
}));

import { resolvePluginAuthComposition as resolveStudioComposition } from './plugin-auth-composition.studio.server.js';
import { resolvePluginAuthComposition as resolveSsfComposition } from './plugin-auth-composition.ssf.server.js';

const readConfiguredPluginTenantAccess: (typeof import('@sva/auth-runtime/server'))['readConfiguredPluginTenantAccess'] =
  async () => ({ allowed: true, reason: 'ready' });

beforeEach(() => vi.clearAllMocks());

describe('profile-specific account-create composition', () => {
  it('binds no SSF contribution or OIDC client in the Studio profile', () => {
    expect(
      resolveStudioComposition({
        pluginSources: [],
        readConfiguredPluginTenantAccess,
      })
    ).toEqual({ accountCreateContribution: undefined, pluginOidcClientRequirements: [] });
    expect(state.createContribution).not.toHaveBeenCalled();
  });

  it('rejects an SSF profile without the installed SSF plugin before publishing a snapshot', () => {
    expect(() =>
      resolveSsfComposition({
        pluginSources: [],
        readConfiguredPluginTenantAccess,
      })
    ).toThrow('ssf_auth_composition_plugin_missing');
    expect(state.createContribution).not.toHaveBeenCalled();
  });

  it('binds the SSF contribution and OIDC requirement only in the SSF profile', () => {
    const composition = resolveSsfComposition({
      pluginSources: [{ pluginId: 'ssf' }],
      readConfiguredPluginTenantAccess,
    });
    expect(state.createContribution).toHaveBeenCalledWith(readConfiguredPluginTenantAccess);
    expect(composition.accountCreateContribution).toBe(
      state.createContribution.mock.results[0]?.value
    );
    expect(composition.pluginOidcClientRequirements).toEqual([
      { pluginId: 'ssf', clientId: 'ssf' },
    ]);
  });
});
