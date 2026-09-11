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

  it('classifies idempotency payload reuse as conflict', () => {
    expect(classifyInstanceMutationError(new Error('idempotency_key_reuse'))).toEqual({
      status: 409,
      code: 'idempotency_key_reuse',
    });
    expect(classifyInstanceMutationError(new Error('instance_configuration_change_blocked'))).toEqual({
      status: 409,
      code: 'instance_configuration_change_blocked',
    });
  });

  it('classifies reserved tenant hosts as invalid requests', () => {
    expect(classifyInstanceMutationError(new Error('tenant_hostname_reserved'))).toEqual({
      status: 400,
      code: 'tenant_hostname_reserved',
    });
  });

  it('classifies reserved OIDC client ids as invalid requests', () => {
    expect(classifyInstanceMutationError(new Error('oidc_client_id_reserved'))).toEqual({
      status: 400,
      code: 'oidc_client_id_reserved',
    });
  });

  it('classifies concurrent plugin activation reconciliation as conflict', () => {
    expect(
      classifyInstanceMutationError(new Error('plugin_activation_state_conflict:events'))
    ).toEqual({
      status: 409,
      code: 'plugin_activation_state_conflict',
    });
  });

  it('classifies duplicate realm assignments as a stable conflict', () => {
    expect(
      classifyInstanceMutationError(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'instances_auth_realm_unique',
        })
      )
    ).toEqual({ status: 409, code: 'auth_realm_conflict' });
  });

  it('classifies tenant RLS and schema write failures as database failures', () => {
    expect(
      classifyInstanceMutationError(
        new Error('new row violates row-level security policy for table "permissions"')
      )
    ).toEqual({
      status: 503,
      code: 'database_unavailable',
    });
  });

  it('keeps unknown failures explicitly unclassified instead of claiming a Keycloak failure', () => {
    expect(classifyInstanceMutationError(new Error('boom'))).toEqual({
      status: 500,
      code: 'internal_unclassified',
    });
  });
});
