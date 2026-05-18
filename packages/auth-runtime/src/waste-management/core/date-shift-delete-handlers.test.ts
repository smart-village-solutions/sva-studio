import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementGlobalDateShiftHandlers } from './global-date-shifts.js';
import { wasteManagementTourDateShiftHandlers } from './tour-date-shifts.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const createDeps = () => ({
  getRequestId: () => 'req-test',
  emitAuditEvent: vi.fn(async () => undefined),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.scheduling.manage',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management date shift delete handlers', () => {
  it('deletes global and tour date shifts after loading the existing records', async () => {
    const deleteWasteGlobalDateShift = vi.fn(async () => undefined);
    const deleteWasteTourDateShift = vi.fn(async () => undefined);
    const globalResponse =
      await wasteManagementGlobalDateShiftHandlers.deleteWasteManagementGlobalDateShiftInternal(
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/global-1', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteGlobalDateShiftById: vi.fn(async () => ({ id: 'global-1' })),
          deleteWasteGlobalDateShift,
        }
      );

    expect(globalResponse.status).toBe(200);
    await expect(globalResponse.json()).resolves.toMatchObject({
      data: { id: 'global-1' },
      requestId: 'req-test',
    });
    expect(deleteWasteGlobalDateShift).toHaveBeenCalledWith('tenant-a', 'global-1');

    const tourResponse =
      await wasteManagementTourDateShiftHandlers.deleteWasteManagementTourDateShiftInternal(
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/tour-1', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteTourDateShiftById: vi.fn(async () => ({ id: 'tour-1' })),
          deleteWasteTourDateShift,
        }
      );

    expect(tourResponse.status).toBe(200);
    await expect(tourResponse.json()).resolves.toMatchObject({
      data: { id: 'tour-1' },
      requestId: 'req-test',
    });
    expect(deleteWasteTourDateShift).toHaveBeenCalledWith('tenant-a', 'tour-1');
  });

  it('returns not-found responses when the shift cannot be loaded before deletion', async () => {
    const globalResponse =
      await wasteManagementGlobalDateShiftHandlers.deleteWasteManagementGlobalDateShiftInternal(
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/missing', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteGlobalDateShiftById: vi.fn(async () => null),
          deleteWasteGlobalDateShift: vi.fn(async () => undefined),
        }
      );
    expect(globalResponse.status).toBe(404);

    const tourResponse =
      await wasteManagementTourDateShiftHandlers.deleteWasteManagementTourDateShiftInternal(
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/missing', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
        actor,
        {
          ...createDeps(),
          loadWasteTourDateShiftById: vi.fn(async () => null),
          deleteWasteTourDateShift: vi.fn(async () => undefined),
        }
      );
    expect(tourResponse.status).toBe(404);
  });
});
