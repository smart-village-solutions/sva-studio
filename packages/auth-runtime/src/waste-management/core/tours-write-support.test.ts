import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loggerInfo,
  emitWasteAuditEvent,
  updateWasteVisibleStatus,
} = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  emitWasteAuditEvent: vi.fn(),
  updateWasteVisibleStatus: vi.fn(),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    createSdkLogger: () => ({
      info: loggerInfo,
    }),
  };
});

vi.mock('./auth.js', () => ({
  emitWasteAuditEvent,
}));

vi.mock('./settings-shared.js', () => ({
  updateWasteVisibleStatus,
}));

import {
  createWasteManagementTourAfterValidation,
  createWasteTourWriteInput,
  deleteWasteTourDependencies,
  duplicateWasteTourDependencies,
} from './tours-write-support.js';

describe('waste tour write support', () => {
  beforeEach(() => {
    loggerInfo.mockReset();
    emitWasteAuditEvent.mockReset();
    updateWasteVisibleStatus.mockReset();
  });

  it('normalizes write input for recurring and custom-date tours', () => {
    expect(
      createWasteTourWriteInput({
        id: 'tour-1',
        name: '  Restmuell Nord  ',
        description: '  Beschreibung  ',
        wasteFractionIds: [' fraction-1 ', 'fraction-2'],
        recurrence: 'weekly',
        customRecurrenceId: undefined,
        firstDate: '2026-01-10',
        endDate: '2026-12-31',
        customDates: [
          {
            date: '2026-01-11',
            description: '  Sondertermin  ',
          },
        ],
        active: true,
        locationCount: 4,
      })
    ).toEqual({
      id: 'tour-1',
      name: 'Restmuell Nord',
      description: 'Beschreibung',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'weekly',
      customRecurrenceId: undefined,
      firstDate: '2026-01-10',
      endDate: '2026-12-31',
      customDates: [
        {
          date: '2026-01-11',
          description: 'Sondertermin',
        },
      ],
      active: true,
      locationCount: 4,
    });

    expect(
      createWasteTourWriteInput({
        id: 'tour-2',
        name: '  Custom Tour  ',
        description: '   ',
        wasteFractionIds: ['fraction-9'],
        recurrence: 'monthly',
        customRecurrenceId: 'preset-1',
        customDates: [],
        active: false,
        locationCount: undefined,
      })
    ).toEqual({
      id: 'tour-2',
      name: 'Custom Tour',
      description: undefined,
      wasteFractionIds: ['fraction-9'],
      recurrence: null,
      customRecurrenceId: 'preset-1',
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      active: false,
      locationCount: undefined,
    });
  });

  it('duplicates linked tour dependencies including shifts', async () => {
    const saveLink = vi.fn(async () => undefined);
    const saveShift = vi.fn(async () => undefined);

    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID');
    randomUuidSpy.mockReturnValueOnce('link-copy-id').mockReturnValueOnce('shift-copy-id');

    await duplicateWasteTourDependencies({
      deps: {
        deleteWasteTour: vi.fn(async () => undefined),
        listWasteLocationTourLinksByTourId: vi.fn(async () => [
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'source-tour',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          },
        ]),
        listWasteTourDateShiftsByTourId: vi.fn(async () => [
          {
            id: 'shift-1',
            tourId: 'source-tour',
            originalDate: '2026-03-01',
            actualDate: '2026-03-02',
            hasYear: true,
            reasonType: 'holiday',
            reasonKey: 'holiday:berlin',
            followUpMode: 'move_forward',
            description: 'Holiday shift',
          },
        ]),
        saveWasteLocationTourLink: saveLink,
        saveWasteTourDateShift: saveShift,
      },
      instanceId: 'tenant-a',
      sourceTourId: 'source-tour',
      targetTourId: 'target-tour',
    });

    expect(saveLink).toHaveBeenCalledWith('tenant-a', {
      id: 'link-copy-id',
      locationId: 'location-1',
      tourId: 'target-tour',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(saveShift).toHaveBeenCalledWith('tenant-a', {
      id: 'shift-copy-id',
      tourId: 'target-tour',
      originalDate: '2026-03-01',
      actualDate: '2026-03-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'holiday:berlin',
      followUpMode: 'move_forward',
      description: 'Holiday shift',
    });

    randomUuidSpy.mockRestore();
  });

  it('rolls back the duplicated tour when dependency copying fails', async () => {
    const deleteTour = vi.fn(async () => undefined);

    await expect(
      duplicateWasteTourDependencies({
        deps: {
          deleteWasteTour: deleteTour,
          listWasteLocationTourLinksByTourId: vi.fn(async () => [
            {
              id: 'link-1',
              locationId: 'location-1',
              tourId: 'source-tour',
              startDate: undefined,
              endDate: undefined,
            },
          ]),
          listWasteTourDateShiftsByTourId: vi.fn(async () => []),
          saveWasteLocationTourLink: vi.fn(async () => {
            throw new Error('copy failed');
          }),
        },
        instanceId: 'tenant-a',
        sourceTourId: 'source-tour',
        targetTourId: 'target-tour',
      })
    ).rejects.toThrow('copy failed');

    expect(deleteTour).toHaveBeenCalledWith('tenant-a', 'target-tour');
  });

  it('deletes links, pickup dates, and shifts for a tour and logs both phases', async () => {
    const deleteLink = vi.fn(async () => undefined);
    const deletePickupDate = vi.fn(async () => undefined);
    const deleteShift = vi.fn(async () => undefined);

    await deleteWasteTourDependencies({
      deps: {
        deleteWasteLocationTourLink: deleteLink,
        deleteWasteLocationTourPickupDate: deletePickupDate,
        deleteWasteTourDateShift: deleteShift,
        listWasteLocationTourLinksByTourId: vi.fn(async () => [
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: undefined,
            endDate: undefined,
          },
        ]),
        listWasteLocationTourPickupDates: vi.fn(async () => [
          {
            id: 'pickup-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            pickupDate: '2026-04-01',
            note: undefined,
          },
        ]),
        listWasteTourDateShiftsByTourId: vi.fn(async () => [
          {
            id: 'shift-1',
            tourId: 'tour-1',
            originalDate: '2026-04-01',
            actualDate: '2026-04-02',
            hasYear: true,
            reasonType: 'holiday',
            reasonKey: 'holiday:test',
            followUpMode: 'move_forward',
            description: undefined,
          },
        ]),
      },
      instanceId: 'tenant-a',
      tourId: 'tour-1',
    });

    expect(deleteLink).toHaveBeenCalledWith('tenant-a', 'link-1');
    expect(deletePickupDate).toHaveBeenCalledWith('tenant-a', 'pickup-1');
    expect(deleteShift).toHaveBeenCalledWith('tenant-a', 'shift-1');
    expect(loggerInfo).toHaveBeenCalledWith(
      'waste_tour_delete_dependencies_loaded',
      expect.objectContaining({
        links_count: 1,
        pickup_dates_count: 1,
        shifts_count: 1,
        tour_id: 'tour-1',
      })
    );
    expect(loggerInfo).toHaveBeenCalledWith(
      'waste_tour_delete_dependencies_completed',
      expect.objectContaining({
        deleted_links_count: 1,
        deleted_pickup_dates_count: 1,
        deleted_shifts_count: 1,
        tour_id: 'tour-1',
      })
    );
  });

  it('returns 503 and emits a failure audit event when the saved tour cannot be reloaded', async () => {
    const response = await createWasteManagementTourAfterValidation({
      deps: {
        loadWasteTourById: vi.fn(async () => null),
        saveWasteTour: vi.fn(async () => undefined),
      },
      ctx: {
        user: {
          id: 'user-1',
          instanceId: 'tenant-a',
          keycloakSubject: 'subject-1',
          roles: [],
        },
      } as never,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      input: {
        id: 'tour-1',
        name: '  Restmuell Nord  ',
        active: true,
        duplicateFromTourId: undefined,
        locationCount: 0,
        wasteFractionIds: ['fraction-1'],
      },
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
      requestId: 'req-1',
    });
    expect(emitWasteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.tour.created',
        reasonCode: 'verification_failed',
        result: 'failure',
      })
    );
    expect(updateWasteVisibleStatus).not.toHaveBeenCalled();
  });

  it('returns 201, emits success, updates visible status, and duplicates dependencies when requested', async () => {
    const loadSavedTour = vi.fn(async () => ({
      id: 'tour-1',
      name: 'Restmuell Nord',
      description: undefined,
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      customRecurrenceId: undefined,
      firstDate: '2026-01-01',
      endDate: undefined,
      customDates: undefined,
      active: true,
      locationCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    const response = await createWasteManagementTourAfterValidation({
      deps: {
        deleteWasteTour: vi.fn(async () => undefined),
        listWasteLocationTourLinksByTourId: vi.fn(async () => []),
        listWasteTourDateShiftsByTourId: vi.fn(async () => []),
        loadWasteTourById: loadSavedTour,
        saveWasteLocationTourLink: vi.fn(async () => undefined),
        saveWasteTour: vi.fn(async () => undefined),
      },
      ctx: {
        user: {
          id: 'user-1',
          instanceId: 'tenant-a',
          keycloakSubject: 'subject-1',
          roles: [],
        },
      } as never,
      instanceId: 'tenant-a',
      requestId: 'req-2',
      input: {
        id: 'tour-1',
        name: ' Restmuell Nord ',
        active: true,
        duplicateFromTourId: 'source-tour',
        firstDate: '2026-01-01',
        locationCount: 0,
        recurrence: 'weekly',
        wasteFractionIds: ['fraction-1'],
      },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 'tour-1',
        name: 'Restmuell Nord',
      },
      requestId: 'req-2',
    });
    expect(emitWasteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.tour.created',
        result: 'success',
        resourceId: 'tour-1',
      })
    );
    expect(updateWasteVisibleStatus).toHaveBeenCalledWith(expect.any(Object), 'tenant-a', 'success');
    expect(loadSavedTour).toHaveBeenCalledWith('tenant-a', 'tour-1');
  });
});
