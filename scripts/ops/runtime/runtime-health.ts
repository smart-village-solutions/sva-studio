export {
  buildOidcClientSecretProbes,
  evaluateOidcClientSecretProbeResponse,
  resolveAcceptanceContainerServices,
  resolveRemoteStackServiceName,
} from './runtime-health-helpers.ts';

import { createRuntimeHealthDoctorChecks } from './runtime-health-doctor-checks.ts';
import { createRuntimeHealthSmokeOps } from './runtime-health-smoke.ts';
import type { RuntimeHealthDeps } from './runtime-health.types.ts';

export const createRuntimeHealthOps = (deps: RuntimeHealthDeps) => {
  const doctorChecks = createRuntimeHealthDoctorChecks(deps);
  const smokeOps = createRuntimeHealthSmokeOps(deps);

  return {
    ...doctorChecks,
    ...smokeOps,
  } as const;
};
