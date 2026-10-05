import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';

const requirements = vi.hoisted(() => vi.fn());
const ready = vi.hoisted(() => vi.fn());

vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginOidcClientRequirements: requirements,
}));
vi.mock('../ssf-login-clients.js', () => ({
  readInstanceSsfLoginClientsReady: ready,
}));

import { resolveInvitationDestination } from './invitation-destination.js';

const authConfig = {
  clientId: 'studio-client',
  redirectUri: 'https://studio.example/auth/callback',
  authRealm: 'tenant-a',
} as AuthConfig;
const ssfRequirement = {
  pluginId: 'ssf',
  contractVersion: '2.0',
  clientId: 'ssf-frontend',
  redirectUris: ['https://dialog.kassel.de/login', 'https://dialog.kassel.de/login/*'],
};

describe('invitation destination', () => {
  beforeEach(() => {
    requirements.mockReset();
    ready.mockReset();
    requirements.mockReturnValue([ssfRequirement]);
    ready.mockResolvedValue(true);
  });

  it('retains the Studio client and instance callback', async () => {
    await expect(
      resolveInvitationDestination({ instanceId: 'tenant-a', purpose: 'studio', authConfig })
    ).resolves.toEqual({
      clientId: 'studio-client',
      redirectUri: 'https://studio.example/auth/callback',
    });
    expect(ready).not.toHaveBeenCalled();
  });

  it('uses the exact installed SSF login and checks the tenant client', async () => {
    await expect(
      resolveInvitationDestination({ instanceId: 'tenant-a', purpose: 'ssf', authConfig })
    ).resolves.toEqual({
      clientId: 'ssf-frontend',
      redirectUri: 'https://dialog.kassel.de/login',
    });
    expect(ready).toHaveBeenCalledWith('tenant-a', 'tenant-a');
  });

  it('rejects missing, invalid, and unready SSF destinations', async () => {
    requirements.mockReturnValue([]);
    await expect(
      resolveInvitationDestination({ instanceId: 'tenant-a', purpose: 'ssf', authConfig })
    ).rejects.toThrow('ssf_invitation_destination_unavailable');

    for (const redirectUris of [
      [],
      ['https://dialog.kassel.de/admin'],
      ['http://dialog.kassel.de/login'],
    ]) {
      requirements.mockReturnValue([{ ...ssfRequirement, redirectUris }]);
      await expect(
        resolveInvitationDestination({ instanceId: 'tenant-a', purpose: 'ssf', authConfig })
      ).rejects.toThrow('ssf_invitation_destination_unavailable');
    }
    requirements.mockReturnValue([ssfRequirement]);
    ready.mockResolvedValue(false);
    await expect(
      resolveInvitationDestination({ instanceId: 'tenant-a', purpose: 'ssf', authConfig })
    ).rejects.toThrow('ssf_invitation_client_not_ready');
  });
});
