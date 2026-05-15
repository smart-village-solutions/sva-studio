import { beforeEach, describe, expect, it, vi } from 'vitest';

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const RESOURCE_ID = '22222222-2222-4222-8222-222222222222';
const GEO_UNIT_ID = '33333333-3333-4333-8333-333333333333';
const GEO_PARENT_ID = '44444444-4444-4444-8444-444444444444';
const GEO_CHILD_ID = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => ({
  emitAuthAuditEvent: vi.fn(async () => undefined),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'workspace-request', traceId: 'workspace-trace' })),
  jsonResponse: vi.fn((status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

vi.mock('../audit-events.js', () => ({
  emitAuthAuditEvent: mocks.emitAuthAuditEvent,
}));

vi.mock('../db.js', () => ({
  jsonResponse: mocks.jsonResponse,
}));

describe('authorize runtime helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('emits plugin action audit events only for non-core fully-qualified action ids', async () => {
    const { emitPluginActionAuditEvent } = await import('./authorize-runtime.js');

    const payload = {
      instanceId: INSTANCE_ID,
      action: 'waste.publish',
      resource: {
        type: 'waste',
        id: RESOURCE_ID,
      },
      context: {
        requestId: 'req-123',
        traceId: 'trace-123',
      },
    } as Parameters<typeof emitPluginActionAuditEvent>[0];

    await emitPluginActionAuditEvent(payload, 'actor-1', 'success');
    await emitPluginActionAuditEvent({ ...payload, action: 'content.publish' }, 'actor-1', 'denied', 'forbidden');
    await emitPluginActionAuditEvent({ ...payload, action: 'not-qualified' }, 'actor-1', 'failure', 'invalid_request');

    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledWith({
      eventType: 'plugin_action_authorized',
      actorUserId: 'actor-1',
      workspaceId: INSTANCE_ID,
      outcome: 'success',
      requestId: 'req-123',
      traceId: 'trace-123',
      pluginAction: {
        actionId: 'waste.publish',
        actionNamespace: 'waste',
        actionOwner: 'waste',
        result: 'success',
        reasonCode: undefined,
        resourceType: 'waste',
        resourceId: RESOURCE_ID,
      },
    });
  });

  it('builds denied authorize responses with audit emission and workspace fallback ids', async () => {
    const { denyAuthorizeRequest } = await import('./authorize-runtime.js');

    const payload = {
      instanceId: INSTANCE_ID,
      action: 'waste.publish',
      resource: {
        type: 'waste',
        id: RESOURCE_ID,
      },
      context: {},
    } as Parameters<typeof denyAuthorizeRequest>[0];

    const recordLatency = vi.fn();
    const response = await denyAuthorizeRequest(
      payload,
      'actor-1',
      {
        reason: 'instance_scope_mismatch',
        instanceId: INSTANCE_ID,
        action: 'waste.publish',
        resourceType: 'waste',
        resourceId: RESOURCE_ID,
        diagnostics: { stage: 'policy' },
      },
      recordLatency
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allowed: false,
      reason: 'instance_scope_mismatch',
      instanceId: INSTANCE_ID,
      action: 'waste.publish',
      resourceType: 'waste',
      resourceId: RESOURCE_ID,
      requestId: 'workspace-request',
      traceId: 'workspace-trace',
      diagnostics: { stage: 'policy' },
    });
    expect(mocks.emitAuthAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_denied',
        actorUserId: 'actor-1',
        outcome: 'denied',
      })
    );
    expect(recordLatency).toHaveBeenCalledWith(false, 'instance_scope_mismatch');
    expect(mocks.jsonResponse).toHaveBeenCalledWith(200, expect.objectContaining({ allowed: false }));
  });

  it('prefers resource geo context and deduplicates hierarchy entries', async () => {
    const { resolveAuthorizeGeoContext } = await import('./authorize-runtime.js');

    const payload = {
      resource: {
        attributes: {
          geoUnitId: GEO_UNIT_ID,
          geoHierarchy: [GEO_PARENT_ID, GEO_PARENT_ID, GEO_CHILD_ID],
        },
      },
      context: {
        attributes: {
          geoUnitId: '66666666-6666-4666-8666-666666666666',
          geoHierarchy: ['77777777-7777-4777-8777-777777777777'],
        },
      },
    } as Parameters<typeof resolveAuthorizeGeoContext>[0];

    expect(resolveAuthorizeGeoContext(payload)).toEqual({
      geoUnitId: GEO_UNIT_ID,
      geoHierarchy: [GEO_PARENT_ID, GEO_CHILD_ID],
    });
  });

  it('falls back to request context geo data and omits empty arrays', async () => {
    const { resolveAuthorizeGeoContext } = await import('./authorize-runtime.js');

    const payload = {
      resource: {
        attributes: {
          geoHierarchy: [],
        },
      },
      context: {
        attributes: {
          geoUnitId: GEO_UNIT_ID,
          geoHierarchy: [GEO_PARENT_ID],
        },
      },
    } as Parameters<typeof resolveAuthorizeGeoContext>[0];

    expect(resolveAuthorizeGeoContext(payload)).toEqual({
      geoUnitId: GEO_UNIT_ID,
      geoHierarchy: [GEO_PARENT_ID],
    });
  });

  it('rejects invalid geo payloads from ids, arrays, and oversized hierarchies', async () => {
    const { resolveAuthorizeGeoContext } = await import('./authorize-runtime.js');

    expect(
      resolveAuthorizeGeoContext({
        resource: { attributes: { geoUnitId: 'not-a-uuid' } },
        context: {},
      } as Parameters<typeof resolveAuthorizeGeoContext>[0])
    ).toBeNull();

    expect(
      resolveAuthorizeGeoContext({
        resource: { attributes: {} },
        context: { attributes: { geoHierarchy: 'not-an-array' } },
      } as Parameters<typeof resolveAuthorizeGeoContext>[0])
    ).toBeNull();

    expect(
      resolveAuthorizeGeoContext({
        resource: {
          attributes: {
            geoHierarchy: Array.from({ length: 33 }, (_, index) =>
              `${String(index + 1).padStart(8, '0')}-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`
            ),
          },
        },
        context: {},
      } as Parameters<typeof resolveAuthorizeGeoContext>[0])
    ).toBeNull();
  });
});
