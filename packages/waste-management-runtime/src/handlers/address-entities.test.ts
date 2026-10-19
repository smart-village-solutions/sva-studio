import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from './types.js';
import { createWasteAddressEntityImpactHandlers } from './address-entities.js';

const guardMocks = vi.hoisted(() => ({
  authorizeWasteMasterDataMutationRequest: vi.fn(async () => ({ instanceId: 'tenant-a', requestId: 'req-address' })),
  authorizeWasteMasterDataMutationPathRequest: vi.fn(async (request: Request) => ({
    instanceId: 'tenant-a', requestId: 'req-address',
    resourceId: new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? '',
  })),
}));
vi.mock('./master-data-request-guards.js', () => guardMocks);

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: { id: 'user-1', instanceId: 'tenant-a', roles: ['system_admin'] },
};
const counts = {
  regions: 1, cities: 2, streets: 3, houseNumbers: 4, collectionLocations: 1,
  locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0,
  fullyRemovedTourAssignments: 0, retainedTourAssignments: 0,
  emailReminderSubscriptions: 1, emailReminderSubscriptionItems: 2,
  emailReminderOutbox: 3, sentEmailReminderOutbox: 1, inconsistentCollectionLocations: 0,
};

const createDeps = () => ({
  getRequestId: () => 'req-address',
  emitAuditEvent: vi.fn(async () => undefined),
  previewWasteAddressMutation: vi.fn(async (_tenant: string, input: unknown) => ({
    entityType: 'region', entityId: 'region-1', mode: 'delete', token: 'snapshot', counts,
    input,
  })),
  mutateWasteAddressInTransaction: vi.fn(async () => counts),
});

const withAuth = (_request: Request, handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>) =>
  handler(_request, actor);

describe('Waste address impact handlers', () => {
  it('passes the validated preview into the authenticated tenant loader', async () => {
    const deps = createDeps();
    const handlers = createWasteAddressEntityImpactHandlers(() => deps, withAuth);
    const request = new Request('https://studio.test/api/v1/waste-management/address-entities/impact-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://studio.test', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify({ entityType: 'region', entityId: 'region-1', mode: 'delete' }),
    });

    const response = await handlers.previewWasteAddressMutation(request);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(guardMocks.authorizeWasteMasterDataMutationRequest).toHaveBeenCalledOnce();
    expect(deps.previewWasteAddressMutation).toHaveBeenCalledWith('tenant-a', { entityType: 'region', entityId: 'region-1', mode: 'delete' });
  });

  it('passes the explicit confirmation token into the tenant transaction for every delete route', async () => {
    for (const [type, path] of [
      ['region', 'regions'], ['city', 'cities'], ['street', 'streets'], ['houseNumber', 'house-numbers'],
    ] as const) {
      const deps = createDeps();
      const handlers = createWasteAddressEntityImpactHandlers(() => deps, withAuth);
      const action = type === 'region' ? handlers.deleteRegion
        : type === 'city' ? handlers.deleteCity
          : type === 'street' ? handlers.deleteStreet : handlers.deleteHouseNumber;
      const response = await action(new Request(`https://studio.test/api/v1/waste-management/${path}/entity-1`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', origin: 'https://studio.test', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ confirmationToken: 'snapshot' }),
      }));

      expect(response.status, await response.clone().text()).toBe(200);
      expect(deps.mutateWasteAddressInTransaction).toHaveBeenCalledWith('tenant-a', {
        entityType: type, entityId: 'entity-1', mode: 'delete', confirmationToken: 'snapshot',
      });
      expect(guardMocks.authorizeWasteMasterDataMutationPathRequest).toHaveBeenCalled();
    }
  });

  it('validates and forwards the merge target through the existing authenticated delete route', async () => {
    const deps = createDeps();
    const handlers = createWasteAddressEntityImpactHandlers(() => deps, withAuth);
    const targetEntityId = '00000000-0000-4000-8000-000000000001';
    const request = (target: string) => new Request('https://studio.test/api/v1/waste-management/regions/source', {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmationToken: 'snapshot', targetEntityId: target }),
    });
    expect((await handlers.deleteRegion(request('invalid'))).status).toBe(400);
    expect(deps.mutateWasteAddressInTransaction).not.toHaveBeenCalled();
    expect((await handlers.deleteRegion(request(targetEntityId))).status).toBe(200);
    expect(deps.mutateWasteAddressInTransaction).toHaveBeenCalledWith('tenant-a', {
      entityType: 'region', entityId: 'source', mode: 'delete', confirmationToken: 'snapshot', targetEntityId,
    });
  });

  it('audits failed address deletes with a bounded failure reason', async () => {
    const deps = createDeps();
    deps.mutateWasteAddressInTransaction.mockRejectedValueOnce(Object.assign(new Error('db failure with data'), { code: 'XX000' }));
    const handlers = createWasteAddressEntityImpactHandlers(() => deps, withAuth);
    const response = await handlers.deleteRegion(new Request('https://studio.test/api/v1/waste-management/regions/region-1', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', origin: 'https://studio.test', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify({ confirmationToken: 'snapshot' }),
    }));

    expect(response.status).toBe(503);
    expect(deps.emitAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'failure',
      pluginAction: expect.objectContaining({ result: 'failure', reasonCode: 'address_mutation_failed' }),
    }));
  });

  it('maps serialization conflicts to refreshable preview conflicts', async () => {
    const deps = createDeps();
    deps.mutateWasteAddressInTransaction.mockRejectedValueOnce(Object.assign(new Error('serialization'), { code: '40001' }));
    const handlers = createWasteAddressEntityImpactHandlers(() => deps, withAuth);
    const response = await handlers.deleteRegion(new Request('https://studio.test/api/v1/waste-management/regions/region-1', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', origin: 'https://studio.test', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify({ confirmationToken: 'snapshot' }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'conflict' } });
  });
});
