import type { InstanceRegistryServiceDeps } from '@sva/instance-registry/service-types';

import { loadWasteDataSourceRecord, saveWasteDataSourceRecord } from '@sva/data-repositories/server';
import { protectField, revealField } from '../iam-account-management/encryption.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';

export const withAuthInstanceRegistryDeps = <TDeps extends Partial<InstanceRegistryServiceDeps>>(
  deps: TDeps
): TDeps &
  Pick<
    InstanceRegistryServiceDeps,
    | 'protectSecret'
    | 'revealSecret'
    | 'readKeycloakStateViaProvisioner'
    | 'loadWasteDataSourceRecord'
    | 'saveWasteDataSourceRecord'
  > => ({
  ...deps,
  protectSecret: protectField,
  revealSecret: revealField,
  readKeycloakStateViaProvisioner,
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
});
