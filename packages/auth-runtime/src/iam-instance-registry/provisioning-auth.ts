import {
  createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader,
} from '@sva/instance-registry/provisioning-auth';

import {
  provisionInstanceAuthArtifacts,
  provisionInstanceAuthArtifactsViaProvisioner,
  readKeycloakAccessError,
  readKeycloakState,
  readKeycloakStateViaProvisioner,
} from './provisioning-auth-state.js';

export { provisionInstanceAuthArtifacts, provisionInstanceAuthArtifactsViaProvisioner };

const createInstanceKeycloakReaders = (
  readState: typeof readKeycloakState
): Readonly<{
  getInstanceKeycloakPreflight: ReturnType<typeof createInstanceKeycloakPreflightReader>;
  getInstanceKeycloakPlan: ReturnType<typeof createInstanceKeycloakPlanReader>;
  getInstanceKeycloakStatus: ReturnType<typeof createInstanceKeycloakStatusReader>;
}> => {
  const getInstanceKeycloakPreflight = createInstanceKeycloakPreflightReader(readState, readKeycloakAccessError);

  return {
    getInstanceKeycloakPreflight,
    getInstanceKeycloakPlan: createInstanceKeycloakPlanReader(readState, getInstanceKeycloakPreflight),
    getInstanceKeycloakStatus: createInstanceKeycloakStatusReader(readState),
  };
};

const defaultReaders = createInstanceKeycloakReaders(readKeycloakState);
const provisionerReaders = createInstanceKeycloakReaders(readKeycloakStateViaProvisioner);

export const getInstanceKeycloakPreflight = defaultReaders.getInstanceKeycloakPreflight;
export const getInstanceKeycloakPreflightViaProvisioner = provisionerReaders.getInstanceKeycloakPreflight;
export const getInstanceKeycloakPlan = defaultReaders.getInstanceKeycloakPlan;
export const getInstanceKeycloakPlanViaProvisioner = provisionerReaders.getInstanceKeycloakPlan;
export const getInstanceKeycloakStatus = defaultReaders.getInstanceKeycloakStatus;
export const getInstanceKeycloakStatusViaProvisioner = provisionerReaders.getInstanceKeycloakStatus;
