import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import { protectField, revealField } from '../iam-account-management/encryption.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';

export const withAuthInstanceRegistryDeps = <TDeps extends Partial<InstanceRegistryServiceDeps>>(
  deps: TDeps
): TDeps & Pick<InstanceRegistryServiceDeps, 'protectSecret' | 'revealSecret' | 'readKeycloakStateViaProvisioner'> => ({
  protectSecret: protectField,
  revealSecret: revealField,
  readKeycloakStateViaProvisioner,
  ...deps,
});
