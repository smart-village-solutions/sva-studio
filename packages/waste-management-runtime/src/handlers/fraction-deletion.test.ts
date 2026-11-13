/** Validate tenant binding and explicit preview confirmation at the existing fraction boundary. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { wasteManagementFractionHandlers as handlers } from './fractions.js';

const guard = vi.hoisted(() => ({
  authorizeWasteMasterDataMutationRequest: vi.fn(),
  authorizeWasteMasterDataMutationPathRequest: vi.fn(),
}));
vi.mock('./master-data-request-guards.js', () => guard);
const source = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
const token = 'a'.repeat(64);
const actor: AuthenticatedRequestContext = {
  sessionId: 'session',
  user: { id: 'actor', instanceId: 'tenant-a', roles: [] },
};
const request = (body: unknown, method = 'POST') =>
  new Request(`https://studio.test/api/v1/waste-management/fractions/${source}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('fraction deletion handlers', () => {
  beforeEach(() => {
    guard.authorizeWasteMasterDataMutationRequest.mockResolvedValue({ instanceId: 'tenant-a' });
    guard.authorizeWasteMasterDataMutationPathRequest.mockResolvedValue({
      instanceId: 'tenant-a',
      resourceId: source,
    });
  });
  it('uses only the authorized tenant and rejects a client supplied tenant', async () => {
    const preview = vi.fn(async () => ({ token }));
    const deps = { previewWasteFractionDeletion: preview } as unknown as WasteManagementHandlerDeps;
    const response = await handlers.previewWasteManagementFractionDeletionInternal(
      request({ fractionId: source, mode: 'detach' }),
      actor,
      deps
    );
    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledWith('tenant-a', { fractionId: source, mode: 'detach' });
    const invalid = await handlers.previewWasteManagementFractionDeletionInternal(
      request({ fractionId: source, mode: 'detach', instanceId: 'tenant-b' }),
      actor,
      deps
    );
    expect(invalid.status).toBe(400);
    expect(preview).toHaveBeenCalledTimes(1);
  });
  it('stops before accessing data when authorization or CSRF guard rejects', async () => {
    const preview = vi.fn();
    guard.authorizeWasteMasterDataMutationRequest.mockResolvedValueOnce(
      new Response(null, { status: 403 })
    );
    const response = await handlers.previewWasteManagementFractionDeletionInternal(
      request({ fractionId: source, mode: 'detach' }),
      actor,
      { previewWasteFractionDeletion: preview }
    );
    expect(response.status).toBe(403);
    expect(preview).not.toHaveBeenCalled();
  });
  it('rejects missing confirmation, missing target, invalid mode and foreign payload fields', async () => {
    const execute = vi.fn();
    for (const body of [
      { mode: 'delete-tours' },
      { mode: 'replace', confirmationToken: token },
      { mode: 'unknown', confirmationToken: token },
      { mode: 'detach', targetFractionId: target, confirmationToken: token },
      { mode: 'delete-tours', confirmationToken: token, fractionId: target },
    ]) {
      const response = await handlers.deleteWasteManagementFractionInternal(
        request(body, 'DELETE'),
        actor,
        { executeWasteFractionDeletion: execute }
      );
      expect(response.status).toBe(400);
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it('returns conflict for a stale confirmed preview without invoking direct deletion', async () => {
    const direct = vi.fn();
    const execute = vi.fn(async () => {
      throw new Error('fraction_preview_stale');
    });
    const deps = {
      loadWasteFractionById: vi.fn(async () => ({ id: source })),
      executeWasteFractionDeletion: execute,
      deleteWasteFraction: direct,
      emitAuditEvent: vi.fn(async () => undefined),
    } as unknown as WasteManagementHandlerDeps;
    const response = await handlers.deleteWasteManagementFractionInternal(
      request({ mode: 'replace', targetFractionId: target, confirmationToken: token }, 'DELETE'),
      actor,
      deps
    );
    expect(response.status).toBe(409);
    expect(execute).toHaveBeenCalledWith('tenant-a', {
      fractionId: source,
      mode: 'replace',
      targetFractionId: target,
      confirmationToken: token,
    });
    expect(direct).not.toHaveBeenCalled();
  });
});
