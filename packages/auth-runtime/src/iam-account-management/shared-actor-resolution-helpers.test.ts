import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  resolveMissingActorDiagnosticReasonMock: vi.fn(),
  annotateActiveSpanMock: vi.fn(),
  addActiveSpanEventMock: vi.fn(),
  createActorResolutionDetailsMock: vi.fn((input) => input),
  createApiErrorMock: vi.fn((status, code, message, requestId, details) =>
    new Response(JSON.stringify({ error: { code, message, details }, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@sva/iam-admin', () => ({
  createActorResolutionServices: () => ({
    resolveActorAccountIdWithProvision: vi.fn(),
    resolveMissingActorDiagnosticReason: state.resolveMissingActorDiagnosticReasonMock,
  }),
  resolveActorAccountId: vi.fn(),
  resolveMissingActorDiagnosticReason: vi.fn(),
}));

vi.mock('./diagnostics.js', () => ({
  annotateActiveSpan: state.annotateActiveSpanMock,
  addActiveSpanEvent: state.addActiveSpanEventMock,
  createActorResolutionDetails: state.createActorResolutionDetailsMock,
}));

vi.mock('./api-helpers.js', () => ({
  createApiError: state.createApiErrorMock,
}));

vi.mock('./shared-observability.js', () => ({
  logger: {
    warn: state.loggerWarnMock,
  },
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('../jit-provisioning.js', () => ({
  jitProvisionAccountWithClient: vi.fn(),
}));

import {
  createInstanceLookupError,
  createMissingActorMembershipError,
  resolveMissingActorDiagnosticReason,
} from './shared-actor-resolution-helpers.js';

describe('shared actor resolution helpers', () => {
  beforeEach(() => {
    state.resolveMissingActorDiagnosticReasonMock.mockReset();
    state.annotateActiveSpanMock.mockReset();
    state.addActiveSpanEventMock.mockReset();
    state.createActorResolutionDetailsMock.mockClear();
    state.createApiErrorMock.mockClear();
    state.loggerWarnMock.mockReset();
  });

  it('maps instance lookup failures to stable api metadata', () => {
    expect(createInstanceLookupError({ reason: 'database_unavailable' }, 'req-1', 'tenant-a')).toEqual({
      status: 503,
      code: 'database_unavailable',
      message: 'IAM-Datenbank ist nicht erreichbar.',
      requestId: 'req-1',
      requestedInstanceId: 'tenant-a',
    });

    expect(createInstanceLookupError({ reason: 'invalid_instance' }, 'req-2')).toEqual({
      status: 400,
      code: 'invalid_instance_id',
      message: 'Ungültige oder fehlende instanceId.',
      requestId: 'req-2',
      requestedInstanceId: undefined,
    });
  });

  it('delegates missing actor diagnostic resolution to the shared actor services', async () => {
    state.resolveMissingActorDiagnosticReasonMock.mockResolvedValueOnce('missing_instance_membership');

    await expect(resolveMissingActorDiagnosticReason('tenant-a', 'kc-1')).resolves.toBe('missing_instance_membership');
    expect(state.resolveMissingActorDiagnosticReasonMock).toHaveBeenCalledWith('tenant-a', 'kc-1');
  });

  it('builds a forbidden actor membership error with tracing, diagnostics and logging', async () => {
    const result = createMissingActorMembershipError({
      diagnosticReason: 'missing_actor_account',
      instanceId: 'tenant-a',
      userId: 'kc-1',
      sessionInstanceId: 'tenant-a',
      mayProvisionMissingActorMembership: true,
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(state.annotateActiveSpanMock).toHaveBeenCalledWith({
      'iam.actor_resolution': 'missing_actor_account',
      'iam.reason_code': 'missing_actor_account',
      'iam.instance_id': 'tenant-a',
    });
    expect(state.addActiveSpanEventMock).toHaveBeenCalledWith('iam.actor_resolution_rejected', {
      'iam.reason_code': 'missing_actor_account',
      'iam.instance_id': 'tenant-a',
    });
    expect(state.loggerWarnMock).toHaveBeenCalledWith(
      'IAM actor resolution rejected request without actor membership',
      expect.objectContaining({
        user_id: 'kc-1',
        instance_id: 'tenant-a',
        allow_jit_provision: true,
        diagnostic_reason: 'missing_actor_account',
      })
    );
    expect(result.error.status).toBe(403);
    await expect(result.error.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        message: 'Akteur-Account nicht gefunden.',
        details: {
          actorResolution: 'missing_actor_account',
          instanceId: 'tenant-a',
        },
      },
      requestId: 'req-1',
    });
  });
});
