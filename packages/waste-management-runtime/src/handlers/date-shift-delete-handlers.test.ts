import { describe, expect, it, vi } from 'vitest';

import {
  createWasteAuthDeps,
  createWasteMutationRequest,
  createWasteTestActor,
} from '../../tests/test-utils/handler-fixtures.js';

import { wasteManagementGlobalDateShiftHandlers } from './global-date-shifts.js';
import { wasteManagementHolidayRuleHandlers } from './holiday-rules.js';
import { wasteManagementTourDateShiftHandlers } from './tour-date-shifts.js';

const actor = createWasteTestActor();

const createDeps = () => ({
  ...createWasteAuthDeps(['waste-management.scheduling.manage']),
  emitAuditEvent: vi.fn(async () => undefined),
});

describe('waste-management date shift delete handlers', () => {
  it('deletes holiday rules, global date shifts and tour date shifts after loading the existing records', async () => {
    const deleteWasteHolidayRule = vi.fn(async () => undefined);
    const deleteWasteGlobalDateShift = vi.fn(async () => undefined);
    const deleteWasteTourDateShift = vi.fn(async () => undefined);
    const holidayResponse =
      await wasteManagementHolidayRuleHandlers.deleteWasteManagementHolidayRuleInternal(
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1'
        ),
        actor,
        {
          ...createDeps(),
          loadWasteHolidayRuleById: vi.fn(async () => ({ id: 'holiday-rule-1' })),
          deleteWasteHolidayRule,
        }
      );

    expect(holidayResponse.status).toBe(200);
    await expect(holidayResponse.json()).resolves.toMatchObject({
      data: { id: 'holiday-rule-1' },
      requestId: 'req-test',
    });
    expect(deleteWasteHolidayRule).toHaveBeenCalledWith('tenant-a', 'holiday-rule-1');

    const globalResponse =
      await wasteManagementGlobalDateShiftHandlers.deleteWasteManagementGlobalDateShiftInternal(
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/global-date-shifts/global-1'
        ),
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
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/tour-date-shifts/tour-1'
        ),
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

  it('returns not-found responses when the holiday rule or shift cannot be loaded before deletion', async () => {
    const holidayResponse =
      await wasteManagementHolidayRuleHandlers.deleteWasteManagementHolidayRuleInternal(
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/holiday-rules/missing'
        ),
        actor,
        {
          ...createDeps(),
          loadWasteHolidayRuleById: vi.fn(async () => null),
          deleteWasteHolidayRule: vi.fn(async () => undefined),
        }
      );
    expect(holidayResponse.status).toBe(404);

    const globalResponse =
      await wasteManagementGlobalDateShiftHandlers.deleteWasteManagementGlobalDateShiftInternal(
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/global-date-shifts/missing'
        ),
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
        createWasteMutationRequest(
          'DELETE',
          'https://studio.test/api/v1/waste-management/tour-date-shifts/missing'
        ),
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
