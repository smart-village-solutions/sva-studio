import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementCollectionLocationHandlers } from './collection-locations.js';
import { wasteManagementLocationTourLinkHandlers } from './location-tour-links.js';
import { wasteManagementReadHandlers } from './read-handlers.js';
import { wasteManagementStreetHandlers } from './streets.js';
import { wasteManagementGlobalDateShiftHandlers } from './global-date-shifts.js';
import { wasteManagementTourDateShiftHandlers } from './tour-date-shifts.js';
import { wasteManagementTourHandlers } from './tours.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const actorWithoutInstance: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: '',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  'content-type': 'application/json',
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const createDeps = (action: string) => ({
  getRequestId: () => 'req-test',
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action,
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

describe('waste-management guard branches', () => {
  it.each([
    {
      label: 'street create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'street-guard',
            name: 'Parkweg',
            cityId: 'city-1',
          }),
        }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'collection location create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-guard',
            cityId: 'city-1',
            active: true,
          }),
        }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'location tour link create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'link-guard',
            locationId: 'location-1',
            tourId: 'tour-1',
          }),
      }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'location tour link delete returns forbidden when the dedicated permission is missing',
      handler: wasteManagementLocationTourLinkHandlers.deleteWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-guard-delete', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'tour create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementTourHandlers.createWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-guard',
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'global shift create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementGlobalDateShiftHandlers.createWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'global-guard',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => createDeps('waste-management.read'),
    },
    {
      label: 'tour shift create returns forbidden when the dedicated permission is missing',
      handler: wasteManagementTourDateShiftHandlers.createWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-shift-guard',
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => createDeps('waste-management.read'),
    },
  ])('$label', async ({ handler, request, deps }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(403);
  });

  it.each([
    {
      label: 'street create rejects a missing actor instance id',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'street-no-instance',
            name: 'Parkweg',
            cityId: 'city-1',
          }),
        }),
      deps: () => createDeps('waste-management.master-data.manage'),
    },
    {
      label: 'collection location create rejects a missing actor instance id',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-no-instance',
            cityId: 'city-1',
            active: true,
          }),
        }),
      deps: () => createDeps('waste-management.master-data.manage'),
    },
    {
      label: 'location tour link create rejects a missing actor instance id',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'link-no-instance',
            locationId: 'location-1',
            tourId: 'tour-1',
          }),
        }),
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'tour create rejects a missing actor instance id',
      handler: wasteManagementTourHandlers.createWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-no-instance',
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'global shift create rejects a missing actor instance id',
      handler: wasteManagementGlobalDateShiftHandlers.createWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'global-no-instance',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
    {
      label: 'tour shift create rejects a missing actor instance id',
      handler: wasteManagementTourDateShiftHandlers.createWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-shift-no-instance',
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
  ])('$label', async ({ handler, request, deps }) => {
    const response = await handler(request(), actorWithoutInstance, deps());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_instance_id',
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'street create rethrows missing save dependencies',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'street-missing-dep',
            name: 'Parkweg',
            cityId: 'city-1',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.master-data.manage'),
        loadWasteStreetById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteStreet',
    },
    {
      label: 'collection location create rethrows missing save dependencies',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-missing-dep',
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.master-data.manage'),
        loadWasteCollectionLocationById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteCollectionLocation',
    },
    {
      label: 'location tour link create rethrows missing save dependencies',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'link-missing-dep',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: ' 2026-05-01 ',
            endDate: ' 2026-05-31 ',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteLocationTourLinkById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteLocationTourLink',
    },
    {
      label: 'tour create rethrows missing save dependencies',
      handler: wasteManagementTourHandlers.createWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-missing-dep',
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
            description: ' Beschreibung ',
            customDates: [{ date: '2026-05-08', description: ' Feiertag ' }],
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteTourById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteTour',
    },
    {
      label: 'global shift create rethrows missing save dependencies',
      handler: wasteManagementGlobalDateShiftHandlers.createWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'global-missing-dep',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            reasonKey: ' feiertag ',
            description: ' verschoben ',
            tourIds: [' tour-1 '],
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteGlobalDateShiftById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteGlobalDateShift',
    },
    {
      label: 'tour shift create rethrows missing save dependencies',
      handler: wasteManagementTourDateShiftHandlers.createWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-shift-missing-dep',
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            reasonKey: ' feiertag ',
            description: ' verschoben ',
            followUpMode: 'none',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteTourDateShiftById: vi.fn(async () => null),
      }),
      expectedError: 'missing_dependency:saveWasteTourDateShift',
    },
  ])('$label', async ({ handler, request, deps, expectedError }) => {
    await expect(handler(request(), actor, deps())).rejects.toThrow(expectedError);
  });

  it.each([
    {
      label: 'street update rethrows missing load dependencies',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/street-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Parkweg',
            cityId: 'city-1',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.master-data.manage'),
        saveWasteStreet: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteStreetById',
    },
    {
      label: 'collection location update rethrows missing load dependencies',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            cityId: 'city-1',
            regionId: 'region-1',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.master-data.manage'),
        saveWasteCollectionLocation: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteCollectionLocationById',
    },
    {
      label: 'location tour link update rethrows missing load dependencies',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: ' 2026-05-01 ',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        saveWasteLocationTourLink: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteLocationTourLinkById',
    },
    {
      label: 'tour update rethrows missing load dependencies',
      handler: wasteManagementTourHandlers.updateWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours/tour-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'custom',
            firstDate: '2026-05-01',
            active: true,
            description: ' Beschreibung ',
            customDates: [{ date: '2026-05-08', description: ' Feiertag ' }],
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        saveWasteTour: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteTourById',
    },
    {
      label: 'global shift update rethrows missing load dependencies',
      handler: wasteManagementGlobalDateShiftHandlers.updateWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/global-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            reasonKey: ' feiertag ',
            description: ' verschoben ',
            tourIds: [],
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        saveWasteGlobalDateShift: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteGlobalDateShiftById',
    },
    {
      label: 'tour shift update rethrows missing load dependencies',
      handler: wasteManagementTourDateShiftHandlers.updateWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/tour-shift-update-missing', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            reasonKey: ' feiertag ',
            description: ' verschoben ',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        saveWasteTourDateShift: vi.fn(async () => undefined),
      }),
      expectedError: 'missing_dependency:loadWasteTourDateShiftById',
    },
  ])('$label', async ({ handler, request, deps, expectedError }) => {
    await expect(handler(request(), actor, deps())).rejects.toThrow(expectedError);
  });

  it.each([
    {
      label: 'settings read returns forbidden when the dedicated permission is missing',
      handler: wasteManagementReadHandlers.getWasteManagementSettingsInternal,
      request: () => new Request('https://studio.test/api/v1/waste-management/settings'),
      deps: () => createDeps('waste-management.read'),
      expectedCode: 'forbidden',
    },
    {
      label: 'history read rejects a missing actor instance id',
      handler: wasteManagementReadHandlers.getWasteManagementHistoryInternal,
      request: () => new Request('https://studio.test/api/v1/waste-management/history'),
      deps: () => createDeps('waste-management.read'),
      actor: actorWithoutInstance,
      expectedCode: 'invalid_instance_id',
      status: 400,
    },
    {
      label: 'master-data overview returns forbidden when the read permission is missing',
      handler: wasteManagementReadHandlers.getWasteManagementMasterDataOverviewInternal,
      request: () => new Request('https://studio.test/api/v1/waste-management/master-data'),
      deps: () => createDeps('waste-management.settings.manage'),
      actor,
      expectedCode: 'forbidden',
      status: 403,
    },
  ])('$label', async ({ handler, request, deps, actor: scopedActor = actor, expectedCode, status = 403 }) => {
    const response = await handler(request(), scopedActor, deps());

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: expectedCode,
      },
    });
  });

  it('covers collection-location create and update guard responses directly for missing instances and csrf violations', async () => {
    const createRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/collection-locations', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ id: 'location-guard-direct', cityId: 'city-1', active: true }),
      });
    const updateRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/collection-locations/location-guard-direct', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({ cityId: 'city-1', active: true }),
      });

    expect(
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        createRequest(),
        actorWithoutInstance,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 400 });
    expect(
      await wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal(
        updateRequest(),
        actorWithoutInstance,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 400 });

    const csrfHeaders = { ...createHeaders(), origin: 'https://evil.test' };
    expect(
      await wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: csrfHeaders,
          body: JSON.stringify({ id: 'location-csrf-direct', cityId: 'city-1', active: true }),
        }),
        actor,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 403 });
    expect(
      await wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal(
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-csrf-direct', {
          method: 'PUT',
          headers: csrfHeaders,
          body: JSON.stringify({ cityId: 'city-1', active: true }),
        }),
        actor,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 403 });
  });

  it('covers location-tour-link create and update guard responses directly for missing instances and csrf violations', async () => {
    const createRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ id: 'link-guard-direct', locationId: 'location-1', tourId: 'tour-1' }),
      });
    const updateRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-guard-direct', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({ locationId: 'location-1', tourId: 'tour-1' }),
      });

    expect(
      await wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal(
        createRequest(),
        actorWithoutInstance,
        createDeps('waste-management.tours.manage')
      )
    ).toMatchObject({ status: 400 });
    expect(
      await wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal(
        updateRequest(),
        actorWithoutInstance,
        createDeps('waste-management.tours.manage')
      )
    ).toMatchObject({ status: 400 });

    const csrfHeaders = { ...createHeaders(), origin: 'https://evil.test' };
    expect(
      await wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: csrfHeaders,
          body: JSON.stringify({ id: 'link-csrf-direct', locationId: 'location-1', tourId: 'tour-1' }),
        }),
        actor,
        createDeps('waste-management.tours.manage')
      )
    ).toMatchObject({ status: 403 });
    expect(
      await wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal(
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-csrf-direct', {
          method: 'PUT',
          headers: csrfHeaders,
          body: JSON.stringify({ locationId: 'location-1', tourId: 'tour-1' }),
        }),
        actor,
        createDeps('waste-management.tours.manage')
      )
    ).toMatchObject({ status: 403 });
  });

  it('covers street create and update guard responses directly for missing instances and csrf violations', async () => {
    const createRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/streets', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ id: 'street-guard-direct', name: 'Parkweg', cityId: 'city-1' }),
      });
    const updateRequest = () =>
      new Request('https://studio.test/api/v1/waste-management/streets/street-guard-direct', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
      });

    expect(
      await wasteManagementStreetHandlers.createWasteManagementStreetInternal(
        createRequest(),
        actorWithoutInstance,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 400 });
    expect(
      await wasteManagementStreetHandlers.updateWasteManagementStreetInternal(
        updateRequest(),
        actorWithoutInstance,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 400 });

    const csrfHeaders = { ...createHeaders(), origin: 'https://evil.test' };
    expect(
      await wasteManagementStreetHandlers.createWasteManagementStreetInternal(
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: csrfHeaders,
          body: JSON.stringify({ id: 'street-csrf-direct', name: 'Parkweg', cityId: 'city-1' }),
        }),
        actor,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 403 });
    expect(
      await wasteManagementStreetHandlers.updateWasteManagementStreetInternal(
        new Request('https://studio.test/api/v1/waste-management/streets/street-csrf-direct', {
          method: 'PUT',
          headers: csrfHeaders,
          body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
        }),
        actor,
        createDeps('waste-management.master-data.manage')
      )
    ).toMatchObject({ status: 403 });
  });
});
