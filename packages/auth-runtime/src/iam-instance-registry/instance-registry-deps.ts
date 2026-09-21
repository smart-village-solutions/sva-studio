import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import {
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
} from '@sva/data-repositories/server';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { readInstanceRegistryPluginOidcClientRequirements } from './plugin-activation-policy-snapshot.js';
import {
  readKeycloakClientSecretsViaProvisioner,
  readKeycloakRealmCreateCapabilityViaProvisioner,
  readKeycloakStateViaProvisioner,
} from './provisioning-auth-state.js';

export const withAuthInstanceRegistryDeps = <TDeps extends Partial<InstanceRegistryServiceDeps>>(
  deps: TDeps
): TDeps &
  Pick<
    InstanceRegistryServiceDeps,
    | 'protectSecret'
    | 'revealSecret'
    | 'readKeycloakClientSecretsViaProvisioner'
    | 'readKeycloakStateViaProvisioner'
    | 'readKeycloakRealmCreateCapability'
    | 'readPluginOidcClientRequirements'
    | 'loadWasteDataSourceRecord'
    | 'saveWasteDataSourceRecord'
  > => ({
  ...deps,
  protectSecret: protectField,
  revealSecret: revealField,
  readKeycloakClientSecretsViaProvisioner,
  readKeycloakStateViaProvisioner,
  readKeycloakRealmCreateCapability: readKeycloakRealmCreateCapabilityViaProvisioner,
  readPluginOidcClientRequirements: readInstanceRegistryPluginOidcClientRequirements,
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
});
