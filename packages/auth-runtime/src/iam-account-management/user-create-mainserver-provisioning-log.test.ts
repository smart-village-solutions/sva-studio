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
          mainserver_status_code: 504,
          mainserver_retryable: true,
        }),
      })
    );
  });

  it('does not treat lookalike errors with wrong field types as provisioning errors', () => {
    const error = Object.assign(new Error('provisioning failed'), {
      name: 'MainserverUserProvisioningError',
      code: 123,
      statusCode: '504',
      retryable: 'yes',
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
});
