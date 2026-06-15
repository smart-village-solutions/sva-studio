import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { wasteManagementCityHandlers } from './cities.js';
import { wasteManagementCollectionLocationHandlers } from './collection-locations.js';
import { wasteManagementFractionHandlers } from './fractions.js';
import { wasteManagementGlobalDateShiftHandlers } from './global-date-shifts.js';
import { wasteManagementHouseNumberHandlers } from './house-numbers.js';
import { wasteManagementLocationTourLinkHandlers } from './location-tour-links.js';
import { wasteManagementRegionHandlers } from './regions.js';
import { wasteManagementStreetHandlers } from './streets.js';
import { wasteManagementTourHandlers } from './tours.js';
import { wasteManagementTourDateShiftHandlers } from './tour-date-shifts.js';

vi.mock('./settings-shared.js', () => ({
  updateWasteVisibleStatus: vi.fn(async () => undefined),
}));

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createHeaders = () => ({
  'content-type': 'application/json',
  origin: 'https://studio.test',
  'x-requested-with': 'XMLHttpRequest',
});

const noneReminderConfigPayload = {
  reminderConfig: {
    reminderCount: 'none',
    channels: {
      push: false,
      email: false,
      calendar: false,
    },
  },
} as const;

const createDeps = (action = 'waste-management.master-data.manage') => ({
  getRequestId: () => 'req-test',
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  resolveActorInfo: vi.fn(async () => ({
    actor: {
      instanceId: 'tenant-a',
      actorAccountId: 'account-1',
      requestId: 'req-test',
      traceId: 'trace-test',
    },
  })),
  startPluginOperationJob: vi.fn(
    async () =>
      new Response(JSON.stringify({ data: { id: 'job-1' } }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
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
  loadMasterDataFractionsOverview: vi.fn(async () => ({
    fractions: [],
    regions: [],
    cities: [],
    streets: [],
    houseNumbers: [],
    collectionLocations: [],
    locationTourLinks: [],
  })),
});

describe('waste-management master-data branch handlers', () => {
  it.each([
    {
      label: 'fraction create rejects invalid payloads',
      handler: wasteManagementFractionHandlers.createWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
      }),
      expectedMessage: /id/i,
    },
    {
      label: 'fraction create rejects invalid reminder counts',
      handler: wasteManagementFractionHandlers.createWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'fraction-invalid-reminder',
            name: 'Papier',
            pdfShortLabel: 'PAP',
            color: '#123456',
            active: true,
            reminderConfig: {
              reminderCount: 'many',
              channels: {
                push: false,
                email: false,
                calendar: false,
              },
            },
          }),
        }),
      expectedMessage: /reminderConfig|reminderCount/i,
    },
    {
      label: 'fraction create rejects reminder defaults above the channel max lead days',
      handler: wasteManagementFractionHandlers.createWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'fraction-invalid-reminder-default',
            name: 'Papier',
            pdfShortLabel: 'PAP',
            color: '#123456',
            active: true,
            reminderConfig: {
              reminderCount: 'once',
              channels: {
                push: true,
                email: false,
                calendar: false,
              },
              push: {
                slots: [{ id: 'fraction-invalid-reminder-default:push:first', maxLeadDays: 7, defaultLeadDays: 14 }],
              },
            },
          }),
        }),
      expectedMessage: /defaultLeadDays|maxLeadDays/i,
    },
    {
      label: 'region create rejects invalid payloads',
      handler: wasteManagementRegionHandlers.createWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
    },
    {
      label: 'city create rejects invalid payloads',
      handler: wasteManagementCityHandlers.createWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
    },
    {
      label: 'house-number create rejects invalid payloads',
      handler: wasteManagementHouseNumberHandlers.createWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
    },
    {
      label: 'street create rejects invalid payloads',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
    },
    {
      label: 'collection-location create rejects invalid payloads',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
    },
    {
      label: 'location-tour-link create rejects invalid payloads',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'tour create rejects invalid payloads',
      handler: wasteManagementTourHandlers.createWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'global-date-shift create rejects invalid payloads',
      handler: wasteManagementGlobalDateShiftHandlers.createWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
    {
      label: 'tour-date-shift create rejects invalid payloads',
      handler: wasteManagementTourDateShiftHandlers.createWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      expectedMessage: /id/i,
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
  ])('$label', async ({ handler, request, expectedMessage, deps }) => {
    const response = await handler(request(), actor, deps?.() ?? createDeps());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringMatching(expectedMessage),
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'street update rejects invalid payloads even when the path id exists',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/street-invalid', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
    },
    {
      label: 'collection-location update rejects invalid payloads even when the path id exists',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-invalid', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
    },
    {
      label: 'location-tour-link update rejects invalid payloads even when the path id exists',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-invalid', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({}),
        }),
      deps: () => createDeps('waste-management.tours.manage'),
    },
  ])('$label', async ({ handler, request, deps }) => {
    const response = await handler(request(), actor, deps?.() ?? createDeps());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringMatching(/required|erforderlich|invalid/i),
      },
      requestId: 'req-test',
    });
  });

  it('rejects duplicate active PDF short labels before saving waste fractions', async () => {
    const duplicateOverview = {
      fractions: [
        {
          id: 'fraction-existing',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          color: '#228833',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    };

    const saveWasteFraction = vi.fn(async () => undefined);

    const createResponse = await wasteManagementFractionHandlers.createWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({
          id: 'fraction-new',
          name: 'Biomüll extra',
          pdfShortLabel: 'bio',
          color: '#22aa55',
          active: true,
          ...noneReminderConfigPayload,
        }),
      }),
      actor,
      {
        ...createDeps(),
        saveWasteFraction,
        loadWasteFractionById: vi.fn(async () => null),
        loadMasterDataFractionsOverview: vi.fn(async () => duplicateOverview),
      }
    );

    expect(createResponse.status).toBe(409);
    await expect(createResponse.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        message: expect.stringContaining('BIO'),
      },
      requestId: 'req-test',
    });
    expect(saveWasteFraction).not.toHaveBeenCalled();

    const updateSaveWasteFraction = vi.fn(async () => undefined);
    const updateResponse = await wasteManagementFractionHandlers.updateWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions/fraction-update', {
        method: 'PUT',
        headers: createHeaders(),
        body: JSON.stringify({
          name: 'Biomüll extra',
          pdfShortLabel: 'bio',
          color: '#22aa55',
          active: true,
          ...noneReminderConfigPayload,
        }),
      }),
      actor,
      {
        ...createDeps(),
        saveWasteFraction: updateSaveWasteFraction,
        loadWasteFractionById: vi.fn(async () => ({
          id: 'fraction-update',
          name: 'Papier',
          pdfShortLabel: 'PAP',
          color: '#123456',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        })),
        loadMasterDataFractionsOverview: vi.fn(async () => duplicateOverview),
      }
    );

    expect(updateResponse.status).toBe(409);
    await expect(updateResponse.json()).resolves.toMatchObject({
      error: {
        code: 'conflict',
        message: expect.stringContaining('BIO'),
      },
      requestId: 'req-test',
    });
    expect(updateSaveWasteFraction).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'fraction update rejects missing path ids',
      handler: wasteManagementFractionHandlers.updateWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Rest',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      expectedMessage: 'fractionId fehlt im Pfad.',
    },
    {
      label: 'region update rejects missing path ids',
      handler: wasteManagementRegionHandlers.updateWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Region Mitte' }),
        }),
      expectedMessage: 'regionId fehlt im Pfad.',
    },
    {
      label: 'city update rejects missing path ids',
      handler: wasteManagementCityHandlers.updateWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Musterstadt', regionId: 'region-1' }),
        }),
      expectedMessage: 'cityId fehlt im Pfad.',
    },
    {
      label: 'house-number update rejects missing path ids',
      handler: wasteManagementHouseNumberHandlers.updateWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ number: '42', streetId: 'street-1' }),
        }),
      expectedMessage: 'houseNumberId fehlt im Pfad.',
    },
    {
      label: 'street update rejects missing path ids',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
        }),
      expectedMessage: 'streetId fehlt im Pfad.',
    },
    {
      label: 'collection-location update rejects missing path ids',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ cityId: 'city-1', active: true }),
        }),
      expectedMessage: 'locationId fehlt im Pfad.',
    },
    {
      label: 'location-tour-link update rejects missing path ids',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ locationId: 'location-1', tourId: 'tour-1' }),
        }),
      expectedMessage: 'linkId fehlt im Pfad.',
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'location-tour-link delete rejects missing path ids',
      handler: wasteManagementLocationTourLinkHandlers.deleteWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
      expectedMessage: 'linkId fehlt im Pfad.',
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'tour update rejects missing path ids',
      handler: wasteManagementTourHandlers.updateWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Tour A', wasteFractionIds: ['fraction-1'], active: true }),
        }),
      expectedMessage: 'tourId fehlt im Pfad.',
      deps: () => createDeps('waste-management.tours.manage'),
    },
    {
      label: 'global-date-shift update rejects missing path ids',
      handler: wasteManagementGlobalDateShiftHandlers.updateWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ originalDate: '2026-05-01', actualDate: '2026-05-02', hasYear: true }),
        }),
      expectedMessage: 'shiftId fehlt im Pfad.',
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
    {
      label: 'tour-date-shift update rejects missing path ids',
      handler: wasteManagementTourDateShiftHandlers.updateWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      expectedMessage: 'shiftId fehlt im Pfad.',
      deps: () => createDeps('waste-management.scheduling.manage'),
    },
  ])('$label', async ({ handler, request, expectedMessage, deps }) => {
    const response = await handler(request(), actor, deps?.() ?? createDeps());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'fraction update returns not_found for unknown records',
      handler: wasteManagementFractionHandlers.updateWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions/fraction-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Rest',
            pdfShortLabel: 'RES',
            translations: { de: 'Restmüll' },
            color: '#111111',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteFractionById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Fraktion wurde nicht gefunden.',
    },
    {
      label: 'region update returns not_found for unknown records',
      handler: wasteManagementRegionHandlers.updateWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions/region-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Region Mitte' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteRegionById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Region wurde nicht gefunden.',
    },
    {
      label: 'city update returns not_found for unknown records',
      handler: wasteManagementCityHandlers.updateWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities/city-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Musterstadt', regionId: 'region-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteCityById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Stadt wurde nicht gefunden.',
    },
    {
      label: 'house-number update returns not_found for unknown records',
      handler: wasteManagementHouseNumberHandlers.updateWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers/house-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ number: '42', streetId: 'street-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteHouseNumberById: vi.fn(async () => null),
        }),
      expectedMessage: 'Die Waste-Hausnummer wurde nicht gefunden.',
    },
    {
      label: 'street update returns not_found for unknown records',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/street-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteStreetById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Straße wurde nicht gefunden.',
    },
    {
      label: 'collection-location update returns not_found for unknown records',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ cityId: 'city-1', regionId: 'region-1', active: true }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteCollectionLocationById: vi.fn(async () => null),
        saveWasteCollectionLocation: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Der Waste-Abholort wurde nicht gefunden.',
    },
    {
      label: 'location-tour-link update returns not_found for unknown records',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ locationId: 'location-1', tourId: 'tour-1' }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteLocationTourLinkById: vi.fn(async () => null),
        saveWasteLocationTourLink: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Die Waste-Tour-Zuordnung wurde nicht gefunden.',
    },
    {
      label: 'location-tour-link delete returns not_found for unknown records',
      handler: wasteManagementLocationTourLinkHandlers.deleteWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-404', {
          method: 'DELETE',
          headers: createHeaders(),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteLocationTourLinkById: vi.fn(async () => null),
        deleteWasteLocationTourLink: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Die Waste-Tour-Zuordnung wurde nicht gefunden.',
    },
    {
      label: 'tour update returns not_found for unknown records',
      handler: wasteManagementTourHandlers.updateWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours/tour-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteTourById: vi.fn(async () => null),
        saveWasteTour: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Die Waste-Tour wurde nicht gefunden.',
    },
    {
      label: 'global-date-shift update returns not_found for unknown records',
      handler: wasteManagementGlobalDateShiftHandlers.updateWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/shift-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ originalDate: '2026-05-01', actualDate: '2026-05-02', hasYear: true }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteGlobalDateShiftById: vi.fn(async () => null),
        saveWasteGlobalDateShift: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Der globale Waste-Ausweichtermin wurde nicht gefunden.',
    },
    {
      label: 'tour-date-shift update returns not_found for unknown records',
      handler: wasteManagementTourDateShiftHandlers.updateWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/shift-404', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteTourDateShiftById: vi.fn(async () => null),
        saveWasteTourDateShift: vi.fn(async () => undefined),
      }),
      expectedMessage: 'Der tourbezogene Waste-Ausweichtermin wurde nicht gefunden.',
    },
  ])('$label', async ({ handler, request, deps, expectedMessage }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'not_found',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it('location-tour-link delete returns the deleted resource id on success', async () => {
    const response = await wasteManagementLocationTourLinkHandlers.deleteWasteManagementLocationTourLinkInternal(
      new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-delete', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      {
        ...createDeps('waste-management.tours.manage'),
        loadWasteLocationTourLinkById: vi.fn(async () => ({ id: 'link-delete', locationId: 'location-1', tourId: 'tour-1' })),
        deleteWasteLocationTourLink: vi.fn(async () => undefined),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 'link-delete' },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'fraction create maps persistence failures to database_unavailable',
      handler: wasteManagementFractionHandlers.createWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'fraction-new',
            name: 'Rest',
            pdfShortLabel: 'RES',
            translations: { de: 'Restmüll' },
            color: '#111111',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteFraction: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
    },
    {
      label: 'region create maps persistence failures to database_unavailable',
      handler: wasteManagementRegionHandlers.createWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'region-new', name: 'Region Mitte' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteRegion: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Region konnte nicht gespeichert werden.',
    },
    {
      label: 'city create maps persistence failures to database_unavailable',
      handler: wasteManagementCityHandlers.createWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'city-new', name: 'Musterstadt', regionId: 'region-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteCity: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Stadt konnte nicht gespeichert werden.',
    },
    {
      label: 'house-number create maps persistence failures to database_unavailable',
      handler: wasteManagementHouseNumberHandlers.createWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'house-new', number: '42', streetId: 'street-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteHouseNumber: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Hausnummer konnte nicht gespeichert werden.',
    },
    {
      label: 'street create maps persistence failures to database_unavailable',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'street-new', name: 'Parkweg', cityId: 'city-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteStreet: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Straße konnte nicht gespeichert werden.',
    },
    {
      label: 'collection-location create maps persistence failures to database_unavailable',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'location-new', cityId: 'city-1', active: true }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteCollectionLocation: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Der Waste-Abholort konnte nicht gespeichert werden.',
    },
    {
      label: 'location-tour-link create maps persistence failures to database_unavailable',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'link-new', locationId: 'location-1', tourId: 'tour-1' }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        saveWasteLocationTourLink: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
    },
  ])('$label', async ({ handler, request, deps, expectedMessage }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'fraction create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementFractionHandlers.createWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'fraction-verify',
            name: 'Papier',
            pdfShortLabel: 'PAP',
            translations: { de: 'Papier' },
            color: '#123456',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteFraction: vi.fn(async () => undefined),
        loadWasteFractionById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
    },
    {
      label: 'region create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementRegionHandlers.createWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'region-verify', name: 'Region Mitte' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteRegion: vi.fn(async () => undefined),
        loadWasteRegionById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Region konnte nicht verifiziert werden.',
    },
    {
      label: 'city create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementCityHandlers.createWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'city-verify', name: 'Musterstadt', regionId: 'region-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteCity: vi.fn(async () => undefined),
        loadWasteCityById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Stadt konnte nicht verifiziert werden.',
    },
    {
      label: 'house-number create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementHouseNumberHandlers.createWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'house-verify', number: '42', streetId: 'street-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteHouseNumber: vi.fn(async () => undefined),
        loadWasteHouseNumberById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Hausnummer konnte nicht verifiziert werden.',
    },
    {
      label: 'street create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementStreetHandlers.createWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ id: 'street-verify', name: 'Parkweg', cityId: 'city-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteStreet: vi.fn(async () => undefined),
        loadWasteStreetById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Straße konnte nicht verifiziert werden.',
    },
    {
      label: 'collection-location create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementCollectionLocationHandlers.createWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'location-verify',
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        saveWasteCollectionLocation: vi.fn(async () => undefined),
        loadWasteCollectionLocationById: vi.fn(async () => null),
      }),
      expectedMessage: 'Der Waste-Abholort konnte nicht verifiziert werden.',
    },
    {
      label: 'location-tour-link create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementLocationTourLinkHandlers.createWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'link-verify',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
            endDate: '2026-05-31',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        saveWasteLocationTourLink: vi.fn(async () => undefined),
        loadWasteLocationTourLinkById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
    },
    {
      label: 'tour create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementTourHandlers.createWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-verify',
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        saveWasteTour: vi.fn(async () => undefined),
        loadWasteTourById: vi.fn(async () => null),
      }),
      expectedMessage: 'Die Waste-Tour konnte nicht verifiziert werden.',
    },
    {
      label: 'global-date-shift create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementGlobalDateShiftHandlers.createWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'global-shift-verify',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            tourIds: ['tour-1'],
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        saveWasteGlobalDateShift: vi.fn(async () => undefined),
        loadWasteGlobalDateShiftById: vi.fn(async () => null),
      }),
      expectedMessage: 'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
    },
    {
      label: 'tour-date-shift create returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementTourDateShiftHandlers.createWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            id: 'tour-shift-verify',
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        saveWasteTourDateShift: vi.fn(async () => undefined),
        loadWasteTourDateShiftById: vi.fn(async () => null),
      }),
      expectedMessage: 'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
    },
  ])('$label', async ({ handler, request, deps, expectedMessage }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'fraction update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementFractionHandlers.updateWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions/fraction-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Papier',
            pdfShortLabel: 'PAP',
            translations: { de: 'Papier' },
            color: '#123456',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      deps: () => {
        const loadWasteFractionById = vi
          .fn()
          .mockResolvedValueOnce({ id: 'fraction-verify', name: 'Alt', createdAt: '', updatedAt: '' })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteFraction: vi.fn(async () => undefined),
          loadWasteFractionById,
        };
      },
      expectedMessage: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
    },
    {
      label: 'region update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementRegionHandlers.updateWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions/region-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Region Mitte' }),
        }),
      deps: () => {
        const loadWasteRegionById = vi
          .fn()
          .mockResolvedValueOnce({ id: 'region-verify', name: 'Alt', createdAt: '', updatedAt: '' })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteRegion: vi.fn(async () => undefined),
          loadWasteRegionById,
        };
      },
      expectedMessage: 'Die Waste-Region konnte nicht verifiziert werden.',
    },
    {
      label: 'city update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementCityHandlers.updateWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities/city-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Musterstadt', regionId: 'region-1' }),
        }),
      deps: () => {
        const loadWasteCityById = vi
          .fn()
          .mockResolvedValueOnce({ id: 'city-verify', name: 'Alt', regionId: 'region-1', createdAt: '', updatedAt: '' })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteCity: vi.fn(async () => undefined),
          loadWasteCityById,
        };
      },
      expectedMessage: 'Die Waste-Stadt konnte nicht verifiziert werden.',
    },
    {
      label: 'house-number update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementHouseNumberHandlers.updateWasteManagementHouseNumberInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/house-numbers/house-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ number: '42', streetId: 'street-1' }),
        }),
      deps: () => {
        const loadWasteHouseNumberById = vi
          .fn()
          .mockResolvedValueOnce({ id: 'house-verify', number: '41', streetId: 'street-1', createdAt: '', updatedAt: '' })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteHouseNumber: vi.fn(async () => undefined),
          loadWasteHouseNumberById,
        };
      },
      expectedMessage: 'Die Waste-Hausnummer konnte nicht verifiziert werden.',
    },
    {
      label: 'street update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/street-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
        }),
      deps: () => {
        const loadWasteStreetById = vi
          .fn()
          .mockResolvedValueOnce({ id: 'street-verify', name: 'Alt', cityId: 'city-1', createdAt: '', updatedAt: '' })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteStreet: vi.fn(async () => undefined),
          loadWasteStreetById,
        };
      },
      expectedMessage: 'Die Waste-Straße konnte nicht verifiziert werden.',
    },
    {
      label: 'collection-location update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          }),
        }),
      deps: () => {
        const loadWasteCollectionLocationById = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'location-verify',
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
            createdAt: '',
            updatedAt: '',
          })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps(),
          saveWasteCollectionLocation: vi.fn(async () => undefined),
          loadWasteCollectionLocationById,
        };
      },
      expectedMessage: 'Der Waste-Abholort konnte nicht verifiziert werden.',
    },
    {
      label: 'location-tour-link update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
            endDate: '2026-05-31',
          }),
        }),
      deps: () => {
        const loadWasteLocationTourLinkById = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'link-verify',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
            endDate: '2026-05-31',
            createdAt: '',
            updatedAt: '',
          })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps('waste-management.tours.manage'),
          saveWasteLocationTourLink: vi.fn(async () => undefined),
          loadWasteLocationTourLinkById,
        };
      },
      expectedMessage: 'Die Waste-Tour-Zuordnung konnte nicht verifiziert werden.',
    },
    {
      label: 'tour update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementTourHandlers.updateWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours/tour-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => {
        const loadWasteTourById = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'tour-verify',
            name: 'Alt',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
            locationCount: 3,
            createdAt: '',
            updatedAt: '',
          })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps('waste-management.tours.manage'),
          saveWasteTour: vi.fn(async () => undefined),
          loadWasteTourById,
        };
      },
      expectedMessage: 'Die Waste-Tour konnte nicht verifiziert werden.',
    },
    {
      label: 'global-date-shift update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementGlobalDateShiftHandlers.updateWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/shift-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => {
        const loadWasteGlobalDateShiftById = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'shift-verify',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            createdAt: '',
            updatedAt: '',
          })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps('waste-management.scheduling.manage'),
          saveWasteGlobalDateShift: vi.fn(async () => undefined),
          loadWasteGlobalDateShiftById,
        };
      },
      expectedMessage: 'Der globale Waste-Ausweichtermin konnte nicht verifiziert werden.',
    },
    {
      label: 'tour-date-shift update returns verification_failed when the saved record cannot be reloaded',
      handler: wasteManagementTourDateShiftHandlers.updateWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/shift-verify', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => {
        const loadWasteTourDateShiftById = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'shift-verify',
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
            createdAt: '',
            updatedAt: '',
          })
          .mockResolvedValueOnce(null);
        return {
          ...createDeps('waste-management.scheduling.manage'),
          saveWasteTourDateShift: vi.fn(async () => undefined),
          loadWasteTourDateShiftById,
        };
      },
      expectedMessage: 'Der tourbezogene Waste-Ausweichtermin konnte nicht verifiziert werden.',
    },
  ])('$label', async ({ handler, request, deps, expectedMessage }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it.each([
    {
      label: 'fraction update maps persistence failures to database_unavailable',
      handler: wasteManagementFractionHandlers.updateWasteManagementFractionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/fractions/fraction-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Papier',
            pdfShortLabel: 'PAP',
            translations: { de: 'Papier' },
            color: '#123456',
            active: true,
            ...noneReminderConfigPayload,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteFractionById: vi.fn(async () => ({
          id: 'fraction-db',
          name: 'Alt',
          translations: {},
          color: '#111111',
          active: true,
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteFraction: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
    },
    {
      label: 'region update maps persistence failures to database_unavailable',
      handler: wasteManagementRegionHandlers.updateWasteManagementRegionInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/regions/region-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Region Mitte' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteRegionById: vi.fn(async () => ({
          id: 'region-db',
          name: 'Alt',
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteRegion: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Region konnte nicht gespeichert werden.',
    },
    {
      label: 'city update maps persistence failures to database_unavailable',
      handler: wasteManagementCityHandlers.updateWasteManagementCityInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/cities/city-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Musterstadt', regionId: 'region-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteCityById: vi.fn(async () => ({
          id: 'city-db',
          name: 'Alt',
          regionId: 'region-1',
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteCity: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Stadt konnte nicht gespeichert werden.',
    },
    {
      label: 'street update maps persistence failures to database_unavailable',
      handler: wasteManagementStreetHandlers.updateWasteManagementStreetInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/streets/street-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({ name: 'Parkweg', cityId: 'city-1' }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteStreetById: vi.fn(async () => ({
          id: 'street-db',
          name: 'Alt',
          cityId: 'city-1',
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteStreet: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Straße konnte nicht gespeichert werden.',
    },
    {
      label: 'collection-location update maps persistence failures to database_unavailable',
      handler: wasteManagementCollectionLocationHandlers.updateWasteManagementCollectionLocationInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/collection-locations/location-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps(),
        loadWasteCollectionLocationById: vi.fn(async () => ({
          id: 'location-db',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteCollectionLocation: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Der Waste-Abholort konnte nicht gespeichert werden.',
    },
    {
      label: 'location-tour-link update maps persistence failures to database_unavailable',
      handler: wasteManagementLocationTourLinkHandlers.updateWasteManagementLocationTourLinkInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
            endDate: '2026-05-31',
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteLocationTourLinkById: vi.fn(async () => ({
          id: 'link-db',
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteLocationTourLink: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Tour-Zuordnung konnte nicht gespeichert werden.',
    },
    {
      label: 'tour update maps persistence failures to database_unavailable',
      handler: wasteManagementTourHandlers.updateWasteManagementTourInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tours/tour-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            name: 'Tour A',
            wasteFractionIds: ['fraction-1'],
            recurrence: 'weekly',
            firstDate: '2026-05-01',
            active: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.tours.manage'),
        loadWasteTourById: vi.fn(async () => ({
          id: 'tour-db',
          name: 'Alt',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-01',
          active: true,
          locationCount: 2,
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteTour: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Die Waste-Tour konnte nicht gespeichert werden.',
    },
    {
      label: 'global-date-shift update maps persistence failures to database_unavailable',
      handler: wasteManagementGlobalDateShiftHandlers.updateWasteManagementGlobalDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/global-date-shifts/global-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteGlobalDateShiftById: vi.fn(async () => ({
          id: 'global-db',
          originalDate: '2026-05-01',
          actualDate: '2026-05-02',
          hasYear: true,
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteGlobalDateShift: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Der globale Waste-Ausweichtermin konnte nicht gespeichert werden.',
    },
    {
      label: 'tour-date-shift update maps persistence failures to database_unavailable',
      handler: wasteManagementTourDateShiftHandlers.updateWasteManagementTourDateShiftInternal,
      request: () =>
        new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/tour-shift-db', {
          method: 'PUT',
          headers: createHeaders(),
          body: JSON.stringify({
            tourId: 'tour-1',
            originalDate: '2026-05-01',
            actualDate: '2026-05-02',
            hasYear: true,
          }),
        }),
      deps: () => ({
        ...createDeps('waste-management.scheduling.manage'),
        loadWasteTourDateShiftById: vi.fn(async () => ({
          id: 'tour-shift-db',
          tourId: 'tour-1',
          originalDate: '2026-05-01',
          actualDate: '2026-05-02',
          hasYear: true,
          createdAt: '',
          updatedAt: '',
        })),
        saveWasteTourDateShift: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
      expectedMessage: 'Der tourbezogene Waste-Ausweichtermin konnte nicht gespeichert werden.',
    },
  ])('$label', async ({ handler, request, deps, expectedMessage }) => {
    const response = await handler(request(), actor, deps());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: expectedMessage,
      },
      requestId: 'req-test',
    });
  });

  it('covers fraction create verification failure and delete success, conflict, and fallback errors', async () => {
    const createDepsWithRepository = () => ({
      ...createDeps(),
      saveWasteFraction: vi.fn(async () => undefined),
      loadWasteFractionById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        }),
      deleteWasteFraction: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ code: '23503' })
        .mockRejectedValueOnce(new Error('db down')),
    });

    const deps = createDepsWithRepository();

    const createVerificationFailed = await wasteManagementFractionHandlers.createWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({
          id: 'fraction-1',
          name: 'Restmüll',
          pdfShortLabel: 'RES',
          color: '#111111',
          active: true,
          ...noneReminderConfigPayload,
        }),
      }),
      actor,
      deps
    );

    expect(createVerificationFailed.status).toBe(503);
    await expect(createVerificationFailed.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });

    const deleteSucceeded = await wasteManagementFractionHandlers.deleteWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions/fraction-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteSucceeded.status).toBe(200);
    expect(deps.startPluginOperationJob).toHaveBeenCalledTimes(1);

    const deleteConflict = await wasteManagementFractionHandlers.deleteWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions/fraction-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteConflict.status).toBe(409);
    await expect(deleteConflict.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });

    const deleteFailure = await wasteManagementFractionHandlers.deleteWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions/fraction-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteFailure.status).toBe(503);
    await expect(deleteFailure.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });
    expect(deps.startPluginOperationJob).toHaveBeenCalledTimes(1);
  });

  it('covers tour delete success, not-found, conflict, and fallback errors', async () => {
    const createTourDeleteDeps = () => ({
      ...createDeps('waste-management.tours.manage'),
      listWasteLocationTourLinksByTourId: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'link-2', locationId: 'location-2', tourId: 'tour-1' }])
        .mockResolvedValueOnce([{ id: 'link-3', locationId: 'location-3', tourId: 'tour-1' }]),
      listWasteLocationTourPickupDates: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'pickup-1', locationId: 'location-1', tourId: 'tour-1', pickupDate: '2026-05-10', note: 'A' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'pickup-2', locationId: 'location-2', tourId: 'tour-1', pickupDate: '2026-05-11', note: 'B' }])
        .mockResolvedValueOnce([{ id: 'pickup-3', locationId: 'location-3', tourId: 'tour-1', pickupDate: '2026-05-12', note: 'C' }]),
      listWasteTourDateShiftsByTourId: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'shift-1', tourId: 'tour-1', originalDate: '2026-05-10', actualDate: '2026-05-11', hasYear: true, reasonType: 'holiday', reasonKey: 'holiday', followUpMode: 'skip' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'shift-2', tourId: 'tour-1', originalDate: '2026-05-11', actualDate: '2026-05-12', hasYear: true, reasonType: 'holiday', reasonKey: 'holiday', followUpMode: 'skip' }])
        .mockResolvedValueOnce([{ id: 'shift-3', tourId: 'tour-1', originalDate: '2026-05-12', actualDate: '2026-05-13', hasYear: true, reasonType: 'holiday', reasonKey: 'holiday', followUpMode: 'skip' }]),
      deleteWasteLocationTourLink: vi.fn().mockResolvedValue(undefined),
      deleteWasteLocationTourPickupDate: vi.fn().mockResolvedValue(undefined),
      deleteWasteTourDateShift: vi.fn().mockResolvedValue(undefined),
      loadWasteTourById: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        }),
      deleteWasteTour: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ code: '23503' })
        .mockRejectedValueOnce(new Error('db down')),
    });

    const deps = createTourDeleteDeps();

    const deleteSucceeded = await wasteManagementTourHandlers.deleteWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours/tour-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteSucceeded.status).toBe(200);
    expect(deps.deleteWasteTour).toHaveBeenNthCalledWith(1, 'tenant-a', 'tour-1');
    expect(deps.deleteWasteLocationTourLink).not.toHaveBeenCalled();
    expect(deps.deleteWasteLocationTourPickupDate).not.toHaveBeenCalled();
    expect(deps.deleteWasteTourDateShift).not.toHaveBeenCalled();

    const deleteNotFound = await wasteManagementTourHandlers.deleteWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours/tour-404', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteNotFound.status).toBe(404);
    await expect(deleteNotFound.json()).resolves.toMatchObject({
      error: {
        code: 'not_found',
      },
    });

    const deleteConflict = await wasteManagementTourHandlers.deleteWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours/tour-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteConflict.status).toBe(409);
    await expect(deleteConflict.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });

    const deleteFailure = await wasteManagementTourHandlers.deleteWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours/tour-1', {
        method: 'DELETE',
        headers: createHeaders(),
      }),
      actor,
      deps
    );
    expect(deleteFailure.status).toBe(503);
    await expect(deleteFailure.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
      },
    });
  });
});
