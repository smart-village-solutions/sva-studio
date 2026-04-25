import { describe, expect, it } from 'vitest';

import {
  SessionStoreUnavailableError,
  SessionUserHydrationError,
  TenantAuthResolutionError,
  TenantScopeConflictError,
} from './runtime-errors.js';

describe('auth runtime errors', () => {
  it('describes session store failures', () => {
    const cause = new Error('redis down');
    const error = new SessionStoreUnavailableError('read_session', cause);

    expect(error).toMatchObject({
      name: 'SessionStoreUnavailableError',
      message: 'Session store unavailable during read_session',
      operation: 'read_session',
      statusCode: 503,
      cause,
    });
  });

  it('describes tenant resolution failures with public messages', () => {
    expect(
      new TenantAuthResolutionError({
        host: 'tenant.example.test',
        reason: 'tenant_not_found',
      })
    ).toMatchObject({
      name: 'TenantAuthResolutionError',
      host: 'tenant.example.test',
      reason: 'tenant_not_found',
      statusCode: 503,
      publicMessage: 'Anmeldung ist für diesen Mandanten momentan nicht verfügbar. Bitte später erneut versuchen.',
    });

    expect(
      new TenantAuthResolutionError({
        host: 'tenant.example.test',
        reason: 'tenant_inactive',
      })
    ).toMatchObject({
      message: 'Tenant auth configuration for tenant.example.test is inactive',
      publicMessage: 'Anmeldung ist für diesen Mandanten derzeit nicht verfügbar, weil die Instanz nicht aktiv ist.',
    });
  });

  it('describes session hydration and tenant scope conflicts', () => {
    expect(new SessionUserHydrationError({ reason: 'missing_instance_id', requestHost: 'tenant.example.test' })).toMatchObject({
      name: 'SessionUserHydrationError',
      statusCode: 401,
      reason: 'missing_instance_id',
      requestHost: 'tenant.example.test',
    });

    expect(new TenantScopeConflictError({ actualInstanceId: 'a', expectedInstanceId: 'b' })).toMatchObject({
      name: 'TenantScopeConflictError',
      statusCode: 401,
      reason: 'tenant_scope_conflict',
      actualInstanceId: 'a',
      expectedInstanceId: 'b',
    });
  });
});
