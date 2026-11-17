import { describe, expect, it, vi } from 'vitest';

import type { DoctorCheck } from '../runtime-env.shared.ts';
import { createDoctorDbTenantChecks } from './doctor-db-tenant-checks.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';
import { buildLocalInstanceRegistryReconciliationInput } from './local-instance-registry.ts';

const createDeps = () => {
  const collectLocalInstanceIdentityDrift = vi.fn(() => []);
  const deps = {
    buildLocalInstanceRegistryReconciliationInput,
    collectLocalInstanceIdentityDrift,
    toDoctorCheck: (name: string, status: DoctorCheck['status'], code: string, message: string) =>
      ({ code, message, name, status }) as DoctorCheck,
  } as unknown as RuntimeDoctorDbCheckDeps;

  return { collectLocalInstanceIdentityDrift, deps };
};

describe('buildLocalInstanceIdentityDoctorCheck', () => {
  it('reports a rejected allowlist as an error check instead of aborting the doctor run', () => {
    const { collectLocalInstanceIdentityDrift, deps } = createDeps();

    const check = createDoctorDbTenantChecks(deps).buildLocalInstanceIdentityDoctorCheck('local-keycloak', {
      SVA_ALLOWED_INSTANCE_IDS: 'De-Musterhausen',
      SVA_PARENT_DOMAIN: 'studio.localhost',
    });

    expect(check).toMatchObject({
      code: 'local_instance_identity_config_invalid',
      name: 'instance-identity',
      status: 'error',
    });
    expect(check.message).toContain('De-Musterhausen (invalid_instance_id)');
    expect(collectLocalInstanceIdentityDrift).not.toHaveBeenCalled();
  });

  it('runs the drift check unchanged for a valid allowlist', () => {
    const { collectLocalInstanceIdentityDrift, deps } = createDeps();

    const check = createDoctorDbTenantChecks(deps).buildLocalInstanceIdentityDoctorCheck('local-keycloak', {
      SVA_ALLOWED_INSTANCE_IDS: ' de-musterhausen ',
      SVA_PARENT_DOMAIN: 'studio.localhost',
    });

    expect(check).toMatchObject({ code: 'local_instance_identity_ready', status: 'ok' });
    expect(collectLocalInstanceIdentityDrift).toHaveBeenCalledOnce();
  });
});
