import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioJobProgress } from '@sva/core';

type WasteSyncClientState = {
  readonly tours: readonly {
    id: string;
    name: string;
    wasteFractionIds: readonly string[];
    recurrence: string;
    customDates: readonly { date: string }[];
    active: true | false;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly fractions: readonly {
    id: string;
    name: string;
    color: string;
    active: true | false;
    reminderCount: string;
    reminderChannelPushEnabled: boolean;
    reminderChannelEmailEnabled: boolean;
    reminderChannelCalendarEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly links: readonly {
    id: string;
    locationId: string;
    tourId: string;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly locations: readonly {
    id: string;
    cityId: string;
    streetId?: string;
    active: true | false;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly locationTourPickupDates: readonly {
    id: string;
    locationId: string;
    tourId: string;
    pickupDate: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly cities: readonly {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly streets: readonly {
    id: string;
    cityId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly tourDateShifts: readonly {
    id: string;
    tourId?: string;
    locationId?: string;
    originalDate: string;
    actualDate: string;
    hasYear: boolean;
    reasonType: string;
    reasonKey?: string;
    followUpMode?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    tourIds?: readonly string[];
  }[];
  readonly globalDateShifts: readonly {
    id: string;
    originalDate: string;
    actualDate: string;
    hasYear: boolean;
    reasonType: string;
    reasonKey?: string;
    tourIds?: readonly string[];
    description?: string;
    createdAt: string;
    updatedAt: string;
  }[];
  readonly holidayRules: readonly {
    id: string;
    holidayDate: string;
    holidayName: string;
    year: number;
    stateCode: string;
    sourceStatus: string;
    configurationStatus: string;
    conflictStatus: string;
    scope?: string;
    strategy?: string;
    createdAt: string;
    updatedAt: string;
  }[];
};

const listSvaMainserverWasteSyncSnapshotMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{
      pickupTimes: Array<{
        id?: string;
        pickupDate: string;
        wasteType: string;
        street: string;
        city?: string;
      }>;
    }> => ({ pickupTimes: [] })
  )
);
const createSvaMainserverWastePickupTimesMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteSvaMainserverWastePickupTimesMock = vi.hoisted(() => vi.fn(async () => undefined));
const withWasteClientMock = vi.hoisted(() => vi.fn(async () => ({
  tours: [],
  fractions: [],
  links: [],
  locations: [],
  locationTourPickupDates: [],
  cities: [],
  streets: [],
  tourDateShifts: [],
  globalDateShifts: [],
  holidayRules: [],
}) as unknown as WasteSyncClientState));

vi.mock('@sva/sva-mainserver/server', () => ({
  CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE: 100,
  listSvaMainserverWasteSyncSnapshot: listSvaMainserverWasteSyncSnapshotMock,
  createSvaMainserverWastePickupTimes: createSvaMainserverWastePickupTimesMock,
  deleteSvaMainserverWastePickupTimes: deleteSvaMainserverWastePickupTimesMock,
}));

vi.mock('./waste-management-operations.shared.js', () => ({
  withWasteClient: withWasteClientMock,
}));

import {
  runWasteManagementMainserverSync,
  runWasteManagementMainserverSyncForInstance,
} from './waste-management-mainserver-sync.server.js';

describe('waste-management-mainserver-sync.server', () => {
  beforeEach(() => {
    listSvaMainserverWasteSyncSnapshotMock.mockReset();
    listSvaMainserverWasteSyncSnapshotMock.mockResolvedValue({ pickupTimes: [] });
    createSvaMainserverWastePickupTimesMock.mockReset();
    createSvaMainserverWastePickupTimesMock.mockResolvedValue(undefined);
    deleteSvaMainserverWastePickupTimesMock.mockReset();
    deleteSvaMainserverWastePickupTimesMock.mockResolvedValue(undefined);
    withWasteClientMock.mockReset();
    withWasteClientMock.mockResolvedValue({
      tours: [],
      fractions: [],
      links: [],
      locations: [],
      locationTourPickupDates: [],
      cities: [],
      streets: [],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
    } as unknown as WasteSyncClientState);
  });

  it('computes create and delete sets from normalized Studio and Mainserver rows', async () => {
    const result = await runWasteManagementMainserverSync({
      studioRows: [
        {
          key: '2026-01-10::restmüll::hauptstraße::musterhausen',
          pickupDate: '2026-01-10',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          zip: '16928',
          city: 'Musterhausen',
        },
      ],
      mainserverRows: [
        {
          id: 'pickup-2',
          key: '2026-01-17::restmüll::hauptstraße::musterhausen',
          pickupDate: '2026-01-17',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          zip: '16928',
          city: 'Musterhausen',
        },
      ],
      dryRun: true,
    });

    expect(result.createCount).toBe(1);
    expect(result.deleteCount).toBe(1);
    expect(result.createItems).toEqual([
      expect.objectContaining({
        pickupDate: '2026-01-10',
      }),
    ]);
    expect(result.deleteItems).toEqual([
      expect.objectContaining({
        id: 'pickup-2',
      }),
    ]);
  });

  it('executes create and delete callbacks only for the computed diff', async () => {
    const createItems = vi.fn(async () => undefined);
    const deleteItems = vi.fn(async () => undefined);

    const result = await runWasteManagementMainserverSync({
      studioRows: [
        {
          key: '2026-01-10::restmüll::hauptstraße::musterhausen',
          pickupDate: '2026-01-10',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          city: 'Musterhausen',
        },
      ],
      mainserverRows: [],
      dryRun: false,
      createItems,
      deleteItems,
    });

    expect(createItems).toHaveBeenCalledWith([
      expect.objectContaining({
        pickupDate: '2026-01-10',
      }),
    ]);
    expect(deleteItems).not.toHaveBeenCalled();
    expect(result.errorCount).toBe(0);
    expect(result.createBatchCount).toBe(1);
    expect(result.deleteByIdCount).toBe(0);
    expect(result.deleteByValueCount).toBe(0);
  });

  it('reports batch and delete-strategy counts in the sync result', async () => {
    const result = await runWasteManagementMainserverSync({
      studioRows: Array.from({ length: 205 }, (_, index) => ({
        key: `2026-01-${String((index % 28) + 1).padStart(2, '0')}::restmüll::hauptstraße ${index + 1}::musterhausen`,
        pickupDate: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
        wasteType: 'Restmüll',
        street: `Hauptstraße ${index + 1}`,
        city: 'Musterhausen',
      })),
      mainserverRows: [
        {
          id: 'pickup-1',
          key: '2026-03-01::restmüll::altstraße 1::musterhausen',
          pickupDate: '2026-03-01',
          wasteType: 'Restmüll',
          street: 'Altstraße 1',
          city: 'Musterhausen',
        },
        {
          key: '2026-03-02::restmüll::altstraße 2::musterhausen',
          pickupDate: '2026-03-02',
          wasteType: 'Restmüll',
          street: 'Altstraße 2',
          city: 'Musterhausen',
        },
      ],
      dryRun: true,
    });

    expect(result.createCount).toBe(205);
    expect(result.createBatchCount).toBe(3);
    expect(result.deleteCount).toBe(2);
    expect(result.deleteByIdCount).toBe(1);
    expect(result.deleteByValueCount).toBe(1);
  });

  it('reports phased and batch-level progress during create and delete execution', async () => {
    const progressEvents: StudioJobProgress[] = [];

    const result = await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      runtimeDeps: {
        now: vi
          .fn<() => Date>()
          .mockReturnValueOnce(new Date('2026-06-16T10:17:17.102Z'))
          .mockReturnValueOnce(new Date('2026-06-16T10:17:17.125Z'))
          .mockReturnValueOnce(new Date('2026-06-16T10:17:18.000Z'))
          .mockReturnValueOnce(new Date('2026-06-16T10:17:18.250Z'))
          .mockReturnValueOnce(new Date('2026-06-16T10:17:18.500Z'))
          .mockReturnValueOnce(new Date('2026-06-16T10:17:18.750Z')),
      },
      syncInput: {
        operation: 'sync-mainserver',
      },
      progressReporter: {
        reportProgress: async (progress) => {
          progressEvents.push(progress);
        },
      },
      batchSize: 2,
    });

    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentStepKey: 'load-studio-state',
          currentStepLabel: 'Studio-Status laden',
          completedSteps: 1,
          totalSteps: 6,
        }),
        expect.objectContaining({
          currentStepKey: 'load-mainserver-snapshot',
          currentStepLabel: 'Mainserver-Snapshot laden',
          completedSteps: 2,
          totalSteps: 6,
        }),
        expect.objectContaining({
          currentStepKey: 'diff-sync-state',
          currentStepLabel: 'Abweichungen berechnen',
          completedSteps: 3,
          totalSteps: 6,
        }),
        expect.objectContaining({
          currentStepKey: 'create-batches',
          currentStepLabel: 'Create-Batches 1/1',
          details: expect.objectContaining({
            operationMode: 'create',
            totalItemCount: 0,
            totalBatchCount: 0,
            processedItemCount: 0,
          }),
        }),
        expect.objectContaining({
          currentStepKey: 'delete-batches',
          currentStepLabel: 'Delete-Batches 1/1',
          details: expect.objectContaining({
            operationMode: 'delete',
            totalItemCount: 0,
            totalBatchCount: 0,
            processedItemCount: 0,
          }),
        }),
        expect.objectContaining({
          currentStepKey: 'complete-operation',
          currentStepLabel: 'Synchronisierung abgeschlossen',
          completedSteps: 6,
          totalSteps: 6,
        }),
      ])
    );
    expect(result).toMatchObject({
      totalBatchCount: 0,
      processedItemCount: 0,
      finalCreateCount: 0,
      finalDeleteCount: 0,
      studioSnapshotCount: 0,
      mainserverSnapshotCount: 0,
    });
  });

  it('forwards the job credential context to mainserver reads and writes', async () => {
    await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      syncInput: {
        operation: 'sync-mainserver',
        keycloakSubject: 'user-1',
        activeOrganizationId: 'org-1',
      },
    });

    expect(listSvaMainserverWasteSyncSnapshotMock).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      keycloakSubject: 'user-1',
      activeOrganizationId: 'org-1',
    });
    expect(createSvaMainserverWastePickupTimesMock).not.toHaveBeenCalled();
    expect(deleteSvaMainserverWastePickupTimesMock).not.toHaveBeenCalled();
  });

  it('does not delete mainserver rows outside the synchronized year window', async () => {
    listSvaMainserverWasteSyncSnapshotMock.mockResolvedValueOnce({
      pickupTimes: [
        {
          id: 'pickup-2030',
          pickupDate: '2030-01-10',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          city: 'Musterhausen',
        },
      ],
    });

    const result = await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      runtimeDeps: {
        now: () => new Date('2026-06-15T00:00:00.000Z'),
      },
      syncInput: {
        operation: 'sync-mainserver',
      },
    });

    expect(result.deleteCount).toBe(0);
    expect(deleteSvaMainserverWastePickupTimesMock).not.toHaveBeenCalled();
  });

  it('matches studio and mainserver rows even when only mainserver provides a ZIP code', async () => {
    const result = await runWasteManagementMainserverSync({
      studioRows: [
        {
          key: '2026-01-10::restmüll::hauptstraße::musterhausen',
          pickupDate: '2026-01-10',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          city: 'Musterhausen',
        },
      ],
      mainserverRows: [
        {
          id: 'pickup-1',
          key: '2026-01-10::restmüll::hauptstraße::musterhausen',
          pickupDate: '2026-01-10',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          zip: '16928',
          city: 'Musterhausen',
        },
      ],
      dryRun: false,
    });

    expect(result.createCount).toBe(0);
    expect(result.deleteCount).toBe(0);
  });

  it('includes imported location pickup dates in the mainserver sync materialization', async () => {
    withWasteClientMock.mockResolvedValueOnce({
      tours: [
        {
          id: 'tour-1',
          name: 'Rundtour',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'on-demand',
          customDates: [],
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#f00',
          active: true,
          reminderCount: 'none',
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [
        {
          id: 'pickup-date-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2026-02-03',
          note: 'Schnee-Ersatztermin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
    });

    const result = await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      runtimeDeps: {
        now: () => new Date('2026-01-15T00:00:00.000Z'),
      },
      syncInput: {
        operation: 'sync-mainserver',
      },
    });

    expect(result.createItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pickupDate: '2026-02-03',
          note: 'Schnee-Ersatztermin',
          wasteType: 'Restmüll',
          street: 'Hauptstraße',
          city: 'Musterhausen',
        }),
      ])
    );
  });

  it('materializes studio rows from tour recurrence and date-shift rules before sync', async () => {
    withWasteClientMock.mockResolvedValueOnce({
      tours: [
        {
          id: 'tour-1',
          name: 'Rundtour',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'on-demand',
          customDates: [{ date: '2026-01-06' }, { date: '2026-01-13' }],
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#f00',
          active: true,
          reminderCount: 'none',
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2026-01-06',
          actualDate: '2026-01-05',
          hasYear: true,
          reasonType: 'holiday',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
    });

    const result = await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      runtimeDeps: {
        now: () => new Date('2026-01-15T00:00:00.000Z'),
      },
      syncInput: {
        operation: 'sync-mainserver',
        keycloakSubject: 'user-1',
      },
    });

    expect(withWasteClientMock).toHaveBeenCalled();
    expect(result.createCount).toBe(2);
    expect(createSvaMainserverWastePickupTimesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'instance-1',
        keycloakSubject: 'user-1',
        items: expect.arrayContaining([
          expect.objectContaining({
            pickupDate: '2026-01-05',
            wasteType: 'Restmüll',
            street: 'Hauptstraße',
            city: 'Musterhausen',
          }),
          expect.objectContaining({
            pickupDate: '2026-01-13',
            wasteType: 'Restmüll',
            street: 'Hauptstraße',
            city: 'Musterhausen',
          }),
        ]),
      })
    );
    expect(deleteSvaMainserverWastePickupTimesMock).not.toHaveBeenCalled();
  });

  it('splits larger sync writes into batches and returns aggregated runtime statistics', async () => {
    const nowMock = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.000Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.100Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.200Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.300Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.400Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.500Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.600Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.700Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.800Z'))
      .mockReturnValueOnce(new Date('2026-01-15T00:00:00.900Z'));

    const progressEvents: StudioJobProgress[] = [];

    withWasteClientMock.mockResolvedValueOnce({
      tours: [
        {
          id: 'tour-1',
          name: 'Rundtour',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'on-demand',
          customDates: [{ date: '2026-01-06' }, { date: '2026-01-13' }, { date: '2026-01-20' }],
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#f00',
          active: true,
          reminderCount: 'none',
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
    } as unknown as WasteSyncClientState);
    listSvaMainserverWasteSyncSnapshotMock.mockResolvedValueOnce({
      pickupTimes: [
        {
          id: 'pickup-delete-1',
          pickupDate: '2026-02-03',
          wasteType: 'Papier',
          street: 'Hauptstraße',
          city: 'Musterhausen',
        },
      ],
    });

    const result = await runWasteManagementMainserverSyncForInstance({
      instanceId: 'instance-1',
      runtimeDeps: { now: nowMock },
      syncInput: {
        operation: 'sync-mainserver',
      },
      progressReporter: {
        reportProgress: async (progress) => {
          progressEvents.push(progress);
        },
      },
      batchSize: 2,
    });

    expect(createSvaMainserverWastePickupTimesMock).toHaveBeenCalledTimes(2);
    expect(deleteSvaMainserverWastePickupTimesMock).toHaveBeenCalledTimes(1);
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentStepKey: 'create-batches',
          currentStepLabel: 'Create-Batches 1/2',
          details: expect.objectContaining({
            operationMode: 'create',
            totalItemCount: 3,
            totalBatchCount: 2,
            currentBatchIndex: 1,
            currentBatchSize: 2,
            processedItemCount: 2,
            createCount: 2,
            deleteCount: 0,
            lastSuccessfulBatchAt: '2026-01-15T00:00:00.200Z',
          }),
        }),
        expect.objectContaining({
          currentStepKey: 'create-batches',
          currentStepLabel: 'Create-Batches 2/2',
          details: expect.objectContaining({
            operationMode: 'create',
            totalItemCount: 3,
            totalBatchCount: 2,
            currentBatchIndex: 2,
            currentBatchSize: 1,
            processedItemCount: 3,
            createCount: 3,
            deleteCount: 0,
          }),
        }),
        expect.objectContaining({
          currentStepKey: 'delete-batches',
          currentStepLabel: 'Delete-Batches 1/1',
          details: expect.objectContaining({
            operationMode: 'delete',
            totalItemCount: 1,
            totalBatchCount: 1,
            currentBatchIndex: 1,
            currentBatchSize: 1,
            processedItemCount: 4,
            createCount: 3,
            deleteCount: 1,
          }),
        }),
      ])
    );
    expect(result).toMatchObject({
      createCount: 3,
      deleteCount: 1,
      totalBatchCount: 3,
      processedItemCount: 4,
      finalCreateCount: 3,
      finalDeleteCount: 1,
      studioSnapshotCount: 3,
      mainserverSnapshotCount: 1,
      averageBatchDurationMs: 100,
      longestBatchDurationMs: 100,
    });
  });

  it('reports zero totals for empty follow-up phases and aligns create batch counts with the effective batch size', async () => {
    const progressEvents: StudioJobProgress[] = [];

    const result = await runWasteManagementMainserverSync({
      studioRows: Array.from({ length: 3 }, (_, index) => ({
        key: `2026-01-0${index + 1}::restmüll::hauptstraße ${index + 1}::musterhausen`,
        pickupDate: `2026-01-0${index + 1}`,
        wasteType: 'Restmüll',
        street: `Hauptstraße ${index + 1}`,
        city: 'Musterhausen',
      })),
      mainserverRows: [],
      dryRun: false,
      batchSize: 2,
      createItems: async () => undefined,
      deleteItems: async () => undefined,
      onBatchProgress: async (details) => {
        progressEvents.push({
          completedSteps: details.operationMode === 'create' ? 4 : 5,
          totalSteps: 6,
          currentStepKey: details.operationMode === 'create' ? 'create-batches' : 'delete-batches',
          currentStepLabel: details.operationMode === 'create' ? 'Create-Batches 1/1' : 'Delete-Batches 1/1',
          details,
        });
      },
    });

    expect(result.createBatchCount).toBe(2);
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentStepKey: 'delete-batches',
          details: expect.objectContaining({
            totalItemCount: 0,
            totalBatchCount: 0,
            processedItemCount: 3,
          }),
        }),
      ])
    );
  });

  it('fails fast when a non-dry-run sync is missing the required writer callback', async () => {
    await expect(
      runWasteManagementMainserverSync({
        studioRows: [
          {
            key: '2026-01-10::restmüll::hauptstraße::musterhausen',
            pickupDate: '2026-01-10',
            wasteType: 'Restmüll',
            street: 'Hauptstraße',
            city: 'Musterhausen',
          },
        ],
        mainserverRows: [],
        dryRun: false,
      })
    ).rejects.toThrow('waste_mainserver_sync_missing_create_writer');
  });
});
