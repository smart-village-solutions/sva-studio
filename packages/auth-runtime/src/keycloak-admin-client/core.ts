import type { IdentityProviderPort } from '../identity-provider-port.js';
import { KeycloakPersonalMcpAccessOperations } from './personal-mcp-access.js';

export { KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './errors.js';
export type { KeycloakAdminFieldError } from './errors.js';
export type {
  KeycloakAdminClientConfig,
  KeycloakAdminUser,
  KeycloakListRolesQuery,
  KeycloakListUsersQuery,
  KeycloakRealmReadRepresentation,
  KeycloakRealmRole,
  KeycloakRealmSettings,
} from './internal-models.js';
export {
  getKeycloakAdminClientConfigFromEnv,
  getKeycloakTenantAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv,
} from './env-config.js';

export class KeycloakAdminClient
  extends KeycloakPersonalMcpAccessOperations
  implements IdentityProviderPort {}
