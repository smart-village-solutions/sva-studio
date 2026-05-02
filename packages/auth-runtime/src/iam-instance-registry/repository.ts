import { createPoolResolver } from '../db.js';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { invalidateInstanceRegistryHost } from '@sva/data-repositories/server';
import { createInstanceRegistryRuntime } from '@sva/instance-registry/runtime-wiring';

import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  getInstanceKeycloakPlanViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner,
  getInstanceKeycloakStatusViaProvisioner,
  provisionInstanceAuthArtifactsViaProvisioner,
} from './provisioning-auth.js';
import { readKeycloakStateViaProvisioner } from './provisioning-auth-state.js';
import { protectField, revealField } from '../iam-account-management/encryption.js';
const getWorkerKeycloakPreflight = async (input: Parameters<typeof getInstanceKeycloakPreflightViaProvisioner>[0]) =>
  getInstanceKeycloakPreflightViaProvisioner(input);

const getWorkerKeycloakPlan = async (input: Parameters<typeof getInstanceKeycloakPlanViaProvisioner>[0]) =>
  getInstanceKeycloakPlanViaProvisioner(input);

const getWorkerKeycloakStatus = async (input: Parameters<typeof getInstanceKeycloakStatusViaProvisioner>[0]) =>
  getInstanceKeycloakStatusViaProvisioner(input);

const resolvePool = createPoolResolver(getIamDatabaseUrl);
const registryRuntime = createInstanceRegistryRuntime({
  resolvePool,
  createRepository: createInstanceRegistryRepository,
  serviceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
  },
  provisioningWorkerServiceDeps: {
    invalidateHost: invalidateInstanceRegistryHost,
    protectSecret: protectField,
    revealSecret: revealField,
    readKeycloakStateViaProvisioner,
    provisionInstanceAuth: provisionInstanceAuthArtifactsViaProvisioner,
    getKeycloakPreflight: getWorkerKeycloakPreflight,
    planKeycloakProvisioning: getWorkerKeycloakPlan,
    getKeycloakStatus: getWorkerKeycloakStatus,
  },
});

export const {
  withRegistryRepository,
  withRegistryService,
  withRegistryProvisioningWorkerService,
  withRegistryProvisioningWorkerDeps,
} = registryRuntime;
