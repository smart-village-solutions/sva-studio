import type { AccountInvitationPurpose } from '@sva/core';

import type { AuthConfig } from '../types.js';
import { readInstanceRegistryPluginOidcClientRequirements } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { readInstanceSsfLoginClientsReady } from '../ssf-login-clients.js';

type Destination = Readonly<{ clientId: string; redirectUri: string }>;

/** The installation-owned OIDC contract is the only source for an SSF redirect. */
export const resolveInvitationDestination = async (input: {
  instanceId: string;
  purpose: AccountInvitationPurpose;
  authConfig: AuthConfig;
}): Promise<Destination> => {
  if (input.purpose === 'studio') {
    return { clientId: input.authConfig.clientId, redirectUri: input.authConfig.redirectUri };
  }

  const requirement = readInstanceRegistryPluginOidcClientRequirements().find(
    (item) => item.pluginId === 'ssf' && item.contractVersion === '2.0'
  );
  if (
    !requirement ||
    requirement.contractVersion !== '2.0' ||
    requirement.clientId !== 'ssf-frontend'
  ) {
    throw new Error('ssf_invitation_destination_unavailable');
  }
  const redirectUri = requirement.redirectUris.find((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        url.pathname === '/login' &&
        url.search === '' &&
        url.hash === '' &&
        url.href === value
      );
    } catch {
      return false;
    }
  });
  if (!redirectUri) {
    throw new Error('ssf_invitation_destination_unavailable');
  }
  if (!(await readInstanceSsfLoginClientsReady(input.instanceId, input.authConfig.authRealm))) {
    throw new Error('ssf_invitation_client_not_ready');
  }
  return { clientId: requirement.clientId, redirectUri };
};
