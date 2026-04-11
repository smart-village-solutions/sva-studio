import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  requestId: 'req-1',
  ensurePlatformAccess: vi.fn(() => null),
  validateCsrf: vi.fn(() => null),
  requireFreshReauth: vi.fn(() => null),
  readDetailInstanceId: vi.fn(() => 'inst-1'),
  readKeycloakRunId: vi.fn(() => 'run-1'),
  withRegistryService: vi.fn(async (work: (service: any) => unknown) =>
    work({
      getKeycloakStatus: vi.fn(async () => ({ realmExists: true })),
      getKeycloakPreflight: vi.fn(async () => ({ overallStatus: 'ready', checks: [] })),
      planKeycloakProvisioning: vi.fn(async () => ({ overallStatus: 'ready', driftSummary: 'ok' })),
      getKeycloakProvisioningRun: vi.fn(async () => ({ id: 'run-1', overallStatus: 'planned' })),
    })
  ),
  executeMutation: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  reconcileMutation: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  mapMutationError: vi.fn(() => new Response(JSON.stringify({ code: 'mapped' }), { status: 502 })),
}));

vi.mock('@sva/sdk/server', () => ({
  getWorkspaceContext: () => ({ requestId: state.requestId }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: (value: unknown) => value,
  createApiError: (status: number, code: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ code, message, requestId }), { status }),
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: (...args: unknown[]) => state.validateCsrf(...args),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, value: unknown) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('./http.js', () => ({
  ensurePlatformAccess: (...args: unknown[]) => state.ensurePlatformAccess(...args),
  readDetailInstanceId: (...args: unknown[]) => state.readDetailInstanceId(...args),
  readKeycloakRunId: (...args: unknown[]) => state.readKeycloakRunId(...args),
  requireFreshReauth: (...args: unknown[]) => state.requireFreshReauth(...args),
}));

vi.mock('./core-mutations.js', () => ({
  executeInstanceKeycloakProvisioningMutation: (...args: unknown[]) => state.executeMutation(...args),
  mapInstanceMutationError: (...args: unknown[]) => state.mapMutationError(...args),
  reconcileInstanceKeycloakMutation: (...args: unknown[]) => state.reconcileMutation(...args),
}));

vi.mock('./repository.js', () => ({
  withRegistryService: (...args: unknown[]) => state.withRegistryService(...args),
}));

import {
  executeInstanceKeycloakProvisioningInternal,
  getInstanceKeycloakPreflightInternal,
  getInstanceKeycloakProvisioningRunInternal,
  getInstanceKeycloakStatusInternal,
  planInstanceKeycloakProvisioningInternal,
  reconcileInstanceKeycloakInternal,
} from './core-keycloak.js';

const readBody = async (response: Response) => JSON.parse(await response.text());

describe('core-keycloak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ensurePlatformAccess.mockReturnValue(null);
    state.validateCsrf.mockReturnValue(null);
    state.requireFreshReauth.mockReturnValue(null);
    state.readDetailInstanceId.mockReturnValue('inst-1');
    state.readKeycloakRunId.mockReturnValue('run-1');
    state.withRegistryService.mockImplementation(async (work: (service: any) => unknown) =>
      work({
        getKeycloakStatus: vi.fn(async () => ({ realmExists: true })),
        getKeycloakPreflight: vi.fn(async () => ({ overallStatus: 'ready', checks: [] })),
        planKeycloakProvisioning: vi.fn(async () => ({ overallStatus: 'ready', driftSummary: 'ok' })),
        getKeycloakProvisioningRun: vi.fn(async () => ({ id: 'run-1', overallStatus: 'planned' })),
      })
    );
  });

  it('returns status payload for getInstanceKeycloakStatusInternal', async () => {
    const response = await getInstanceKeycloakStatusInternal(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);
    expect(response.status).toBe(200);
    expect(body.realmExists).toBe(true);
  });

  it('returns 404 when preflight result is missing', async () => {
    state.withRegistryService.mockImplementationOnce(async (work: (service: any) => unknown) =>
      work({ getKeycloakPreflight: vi.fn(async () => null) })
    );

    const response = await getInstanceKeycloakPreflightInternal(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);
    expect(response.status).toBe(404);
    expect(body.code).toBe('not_found');
  });

  it('requires mutation guards for plan endpoint', async () => {
    state.validateCsrf.mockReturnValueOnce(new Response('csrf', { status: 403 }));

    const response = await planInstanceKeycloakProvisioningInternal(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    expect(response.status).toBe(403);
    expect(state.withRegistryService).not.toHaveBeenCalled();
  });

  it('returns 400 when provisioning run id is missing', async () => {
    state.readKeycloakRunId.mockReturnValueOnce(undefined);

    const response = await getInstanceKeycloakProvisioningRunInternal(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    const body = await readBody(response);
    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_request');
  });

  it('maps internal read errors via mapInstanceMutationError', async () => {
    const thrown = new Error('backend down');
    state.withRegistryService.mockImplementationOnce(async () => {
      throw thrown;
    });

    const response = await getInstanceKeycloakProvisioningRunInternal(new Request('http://localhost'), { user: { id: 'u-1' } } as never);
    expect(response.status).toBe(502);
    expect(state.mapMutationError).toHaveBeenCalledWith(thrown);
  });

  it('delegates execute and reconcile internals to mutation handlers', async () => {
    const executeResponse = await executeInstanceKeycloakProvisioningInternal(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never
    );
    const reconcileResponse = await reconcileInstanceKeycloakInternal(
      new Request('http://localhost'),
      { user: { id: 'u-1' } } as never
    );

    expect(executeResponse.status).toBe(200);
    expect(reconcileResponse.status).toBe(200);
    expect(state.executeMutation).toHaveBeenCalledTimes(1);
    expect(state.reconcileMutation).toHaveBeenCalledTimes(1);
  });
});
