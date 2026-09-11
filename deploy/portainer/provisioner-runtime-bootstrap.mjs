import { configureInstanceRegistryPluginOidcClientRequirements } from '@sva/auth-runtime/server';
import { SSF_TENANT_OIDC_CLIENT_REQUIREMENT } from '@sva/plugin-ssf/provisioning';

configureInstanceRegistryPluginOidcClientRequirements([
  SSF_TENANT_OIDC_CLIENT_REQUIREMENT,
]);
