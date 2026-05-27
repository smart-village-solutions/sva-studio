import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./settings-shared.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settings-shared.js')>();
  return {
    ...actual,
    updateWasteVisibleStatus: updateWasteVisibleStatusMock,
  };
});

import { wasteManagementLocationTourLinkBulkHandlers } from './location-tour-links-bulk.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createRequest = (body: Record<string, unknown>) =>
  new Request('https://studio.test/api/v1/waste-management/location-tour-links/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
  });

const createDeps = () => ({
  getRequestId: () => 'req-test',
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.tours.manage',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  saveWasteLocationTourLinksBulk: vi.fn(async () => [
    {
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: undefined,
    },
  ]),
});

describe('waste-management bulk location-tour-link handlers', () => {
  beforeEach(() => {
    updateWasteVisibleStatusMock.mockClear();
  });

  it('rejects duplicate location ids during schema refinement', async () => {
    const response = await wasteManagementLocationTourLinkBulkHandlers.createWasteManagementLocationTourLinksBulkInternal(
      createRequest({
        locationIds: ['location-1', ' location-1 '],
        tourId: 'tour-1',
      }),
      actor,
      createDeps()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('Duplikate'),
      },
    });
  });

  it('normalizes optional fields and updates visible status on success', async () => {
    const deps = createDeps();

    const response = await wasteManagementLocationTourLinkBulkHandlers.createWasteManagementLocationTourLinksBulkInternal(
      createRequest({
        locationIds: [' location-1 '],
        tourId: 'tour-1',
        startDate: ' 2026-05-01 ',
      }),
      actor,
      deps
    );

    expect(response.status).toBe(201);
    expect(deps.saveWasteLocationTourLinksBulk).toHaveBeenCalledWith('tenant-a', {
      locationIds: ['location-1'],
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: undefined,
    });
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'success');
  });

  it('returns database_unavailable and revalidates when persistence fails', async () => {
    const deps = createDeps();
    deps.saveWasteLocationTourLinksBulk.mockImplementationOnce(async () => {
      throw new Error('db down');
    });

    const response = await wasteManagementLocationTourLinkBulkHandlers.createWasteManagementLocationTourLinksBulkInternal(
      createRequest({
        locationIds: ['location-1'],
        tourId: 'tour-1',
      }),
      actor,
      deps
    );

    expect(response.status).toBe(503);
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'revalidate');
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) =>
          event.pluginAction.actionId === 'waste-management.location-tour-link.bulk-created' &&
          event.pluginAction.result === 'failure' &&
          event.pluginAction.reasonCode === 'database_unavailable'
      )
    ).toBe(true);
  });

  it('rethrows missing dependency failures for the bulk saver', async () => {
    await expect(
      wasteManagementLocationTourLinkBulkHandlers.createWasteManagementLocationTourLinksBulkInternal(
        createRequest({
          locationIds: ['location-1'],
          tourId: 'tour-1',
        }),
        actor,
        {
          ...createDeps(),
          saveWasteLocationTourLinksBulk: undefined,
        }
      )
    ).rejects.toThrow('missing_dependency:saveWasteLocationTourLinksBulk');
  });
});
