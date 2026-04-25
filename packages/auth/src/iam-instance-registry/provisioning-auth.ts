import {
  createInstanceKeycloakPlanReader,
  createInstanceKeycloakPreflightReader,
  createInstanceKeycloakStatusReader,
} from '@sva/instance-registry';

import {
  provisionInstanceAuthArtifacts,
  provisionInstanceAuthArtifactsViaProvisioner,
  readKeycloakAccessError,
  readKeycloakState,
  readKeycloakStateViaProvisioner,
} from './provisioning-auth-state.js';

export { provisionInstanceAuthArtifacts, provisionInstanceAuthArtifactsViaProvisioner };

export const getInstanceKeycloakPreflight = createInstanceKeycloakPreflightReader(
  readKeycloakState,
  readKeycloakAccessError
);

export const getInstanceKeycloakPreflightViaProvisioner = createInstanceKeycloakPreflightReader(
  readKeycloakStateViaProvisioner,
  readKeycloakAccessError
);

export const getInstanceKeycloakPlan = createInstanceKeycloakPlanReader(
  readKeycloakState,
  getInstanceKeycloakPreflight
);

export const getInstanceKeycloakPlanViaProvisioner = createInstanceKeycloakPlanReader(
  readKeycloakStateViaProvisioner,
  getInstanceKeycloakPreflightViaProvisioner
);

export const getInstanceKeycloakStatus = createInstanceKeycloakStatusReader(readKeycloakState);

export const getInstanceKeycloakStatusViaProvisioner = createInstanceKeycloakStatusReader(readKeycloakStateViaProvisioner);
