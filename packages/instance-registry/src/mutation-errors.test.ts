import { describe, expect, it } from 'vitest';

import { classifyInstanceMutationError } from './mutation-errors.js';

describe('mutation-errors', () => {
  it('classifies provisioning drift blockers with drift metadata', () => {
    expect(
      classifyInstanceMutationError(
        new Error('registry_or_provisioning_drift_blocked:Tenant-Admin-Client fehlt')
      )
    ).toEqual({
      status: 409,
      code: 'tenant_admin_client_not_configured',
      details: {
        dependency: 'keycloak',
        reason_code: 'registry_or_provisioning_drift_blocked',
        drift_summary: 'Tenant-Admin-Client fehlt',
      },
    });
  });

  it('preserves tenant auth secret blockers inside drift summaries', () => {
    expect(
      classifyInstanceMutationError(
        new Error(
          'registry_or_provisioning_drift_blocked:Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.'
        )
      )
    ).toMatchObject({
      status: 409,
      code: 'tenant_auth_client_secret_missing',
    });
  });

  it('classifies encryption bootstrap failures as service unavailable', () => {
    expect(classifyInstanceMutationError(new Error('pii_encryption_required_not_ready'))).toEqual({
      status: 503,
      code: 'encryption_not_configured',
    });
  });

  it('classifies unknown failures as keycloak dependency failures', () => {
    expect(classifyInstanceMutationError(new Error('boom'))).toEqual({
      status: 502,
      code: 'keycloak_unavailable',
    });
  });
});
