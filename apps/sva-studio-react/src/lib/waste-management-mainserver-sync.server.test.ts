import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      dryRun: false,
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
});
