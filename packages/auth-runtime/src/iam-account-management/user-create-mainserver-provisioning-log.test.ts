import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerState = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  logger: loggerState,
}));

import { logMainserverProvisioningFailure } from './user-create-mainserver-provisioning-log.js';

const actor = {
  instanceId: 'bb-demo',
  actorAccountId: 'actor-1',
  requestId: 'req-1',
  traceId: 'trace-1',
  activeOrganizationId: null,
};

describe('logMainserverProvisioningFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs structured mainserver error fields only for type-safe provisioning errors', () => {
    const error = Object.assign(new Error('provisioning failed'), {
      name: 'MainserverUserProvisioningError',
      code: 'upstream_timeout',
      statusCode: 504,
      retryable: true,
      outcomeUnknown: true,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error).toHaveBeenCalledWith(
      'IAM user mainserver provisioning failed',
      expect.objectContaining({
        context: expect.objectContaining({
          mainserver_error_code: 'upstream_timeout',
          mainserver_failure_phase: 'provisioning',
          mainserver_status_code: 504,
          mainserver_retryable: true,
          mainserver_outcome_unknown: true,
        }),
      })
    );
    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({ error: 'upstream_timeout' })
    );
  });

  it('does not treat lookalike errors with wrong field types as provisioning errors', () => {
    const error = Object.assign(new Error('provisioning failed'), {
      name: 'MainserverUserProvisioningError',
      code: 123,
      statusCode: '504',
      retryable: 'yes',
      outcomeUnknown: 'no',
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error).toHaveBeenCalledWith(
      'IAM user mainserver provisioning failed',
      expect.objectContaining({
        context: expect.not.objectContaining({
          mainserver_error_code: expect.anything(),
          mainserver_status_code: expect.anything(),
          mainserver_retryable: expect.anything(),
        }),
      })
    );
  });

  it('logs non-Error inputs defensively without leaking their string representation', () => {
    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error: { message: 'structured-but-not-an-error' },
    });

    expect(loggerState.error).toHaveBeenCalledWith(
      'IAM user mainserver provisioning failed',
      expect.objectContaining({
        context: expect.objectContaining({
          error_type: 'object',
        }),
      })
    );
    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({ error: 'mainserver_user_provisioning_failed' })
    );
  });

  it.each([
    {
      code: 'token_request_failed',
      expectedCode: 'token_request_failed',
      statusCode: 403,
      phase: 'token',
    },
    {
      code: 'tenant_forbidden',
      expectedCode: 'mainserver_tenant_forbidden',
      statusCode: 403,
      phase: 'provisioning',
    },
    {
      code: 'request_rejected',
      expectedCode: 'mainserver_request_rejected',
      statusCode: 422,
      phase: 'provisioning',
    },
  ])('classifies $code as $phase without logging the upstream message', (input) => {
    const error = Object.assign(new Error('untrusted upstream rejection detail'), {
      name: 'MainserverUserProvisioningError',
      code: input.code,
      statusCode: input.statusCode,
      retryable: false,
      outcomeUnknown: false,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({
        mainserver_error_code: input.expectedCode,
        mainserver_failure_phase: input.phase,
        mainserver_status_code: input.statusCode,
      })
    );
    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({ error: input.expectedCode })
    );
  });

  it.each([
    { statusCode: 403, expectedCode: 'mainserver_tenant_forbidden' },
    { statusCode: 422, expectedCode: 'mainserver_request_rejected' },
  ])('classifies a bodyless provisioning rejection with status $statusCode', (input) => {
    const error = Object.assign(new Error('controlled fallback message'), {
      name: 'MainserverUserProvisioningError',
      code: 'mainserver_user_provisioning_failed',
      statusCode: input.statusCode,
      retryable: false,
      outcomeUnknown: false,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({
        mainserver_error_code: input.expectedCode,
        mainserver_failure_phase: 'provisioning',
      })
    );
  });

  it('preserves identity provider failures as credential diagnostics', () => {
    const error = Object.assign(new Error('controlled identity provider failure'), {
      name: 'MainserverUserProvisioningError',
      code: 'identity_provider_unavailable',
      statusCode: 503,
      retryable: true,
      outcomeUnknown: false,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({
        mainserver_error_code: 'identity_provider_unavailable',
        mainserver_failure_phase: 'credentials',
      })
    );
  });

  it.each([
    'alice@example.com',
    'tenant_forbidden\nforged_log_entry=true',
    'x'.repeat(10_000),
  ])('replaces an untrusted upstream error code with a stable fallback', (untrustedCode) => {
    const error = Object.assign(new Error('untrusted upstream rejection detail'), {
      name: 'MainserverUserProvisioningError',
      code: untrustedCode,
      statusCode: 409,
      retryable: false,
      outcomeUnknown: false,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({
        mainserver_error_code: 'mainserver_user_provisioning_failed',
        mainserver_failure_phase: 'unknown',
      })
    );
    expect(loggerState.error.mock.calls[0]?.[1]?.context).not.toEqual(
      expect.objectContaining({ mainserver_error_code: untrustedCode })
    );
  });

  it.each([
    { code: 'upstream_timeout', outcomeUnknown: false, phase: 'token' },
    { code: 'upstream_timeout', outcomeUnknown: true, phase: 'provisioning' },
    { code: 'network_error', outcomeUnknown: false, phase: 'token' },
    { code: 'network_error', outcomeUnknown: true, phase: 'provisioning' },
    { code: 'invalid_response', outcomeUnknown: false, phase: 'unknown' },
    { code: 'invalid_response', outcomeUnknown: true, phase: 'provisioning' },
  ])('uses outcome knowledge to classify ambiguous $code failures', (input) => {
    const error = Object.assign(new Error('controlled message'), {
      name: 'MainserverUserProvisioningError',
      code: input.code,
      statusCode: 502,
      retryable: false,
      outcomeUnknown: input.outcomeUnknown,
    });

    logMainserverProvisioningFailure({
      actor,
      email: 'alice@example.com',
      keycloakSubject: 'kc-user-1',
      error,
    });

    expect(loggerState.error.mock.calls[0]?.[1]?.context).toEqual(
      expect.objectContaining({
        error: input.code,
        mainserver_failure_phase: input.phase,
      })
    );
  });
});
