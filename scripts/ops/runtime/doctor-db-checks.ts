import { createDoctorDbInstanceChecks } from './doctor-db-instance-checks.ts';
import { createDoctorDbSchemaChecks } from './doctor-db-schema-checks.ts';
import { createDoctorDbTenantChecks } from './doctor-db-tenant-checks.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';

export const createRuntimeDoctorDbCheckOps = (deps: RuntimeDoctorDbCheckDeps) => {
  const schemaChecks = createDoctorDbSchemaChecks(deps);
  const instanceChecks = createDoctorDbInstanceChecks(deps);
  const tenantChecks = createDoctorDbTenantChecks(deps);

  return {
    ...instanceChecks,
    ...schemaChecks,
    ...tenantChecks,
  } as const;
};
