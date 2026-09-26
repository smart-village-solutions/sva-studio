import { createSsfAccountCreateContribution } from '@sva/plugin-ssf/runtime';
import {
  SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
  readSsfLoginClientRequirement,
} from '@sva/plugin-ssf/provisioning';

import type { AccountCreateContribution } from '@sva/auth-runtime/server';

export const resolvePluginAuthComposition = (input: {
  pluginSources: readonly { pluginId: string }[];
  readConfiguredPluginTenantAccess: (typeof import('@sva/auth-runtime/server'))['readConfiguredPluginTenantAccess'];
}): {
  accountCreateContribution: AccountCreateContribution;
  pluginOidcClientRequirements: readonly [
    typeof SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
    ...NonNullable<ReturnType<typeof readSsfLoginClientRequirement>>[],
  ];
} => {
  if (!input.pluginSources.some(({ pluginId }) => pluginId === 'ssf')) {
    throw new Error('ssf_auth_composition_plugin_missing');
  }
  return {
    accountCreateContribution: createSsfAccountCreateContribution(
      input.readConfiguredPluginTenantAccess
    ),
    pluginOidcClientRequirements: [
      SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
      ...[readSsfLoginClientRequirement()].filter((entry) => entry !== null),
    ],
  };
};
