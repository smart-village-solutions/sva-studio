import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import {
  createWasteHandlerDeps,
  createWasteMutationRequest,
  createWasteTestActor,
  wasteResolvedActorInfo,
} from '../tests/test-utils/handler-fixtures.js';
import { wasteManagementCoreHandlers } from './handlers.js';

const {
  createWasteManagementCityInternal,
  createWasteManagementCollectionLocationInternal,
  createWasteManagementFractionInternal,
  createWasteManagementGlobalDateShiftInternal,
  createWasteManagementHouseNumberInternal,
  createWasteManagementLocationTourLinkInternal,
  createWasteManagementLocationTourLinksBulkInternal,
  createWasteManagementRegionInternal,
  createWasteManagementStreetInternal,
  createWasteManagementTourDateShiftInternal,
  createWasteManagementTourInternal,
  deleteWasteManagementLocationTourLinkInternal,
  getWasteManagementHistoryInternal,
  getWasteManagementMasterDataOverviewInternal,
  getWasteManagementSchedulingOverviewInternal,
  getWasteManagementSettingsInternal,
  getWasteManagementToursOverviewInternal,
  startWasteManagementInitializeInternal,
  startWasteManagementImportInternal,
  startWasteManagementMigrationsInternal,
  startWasteManagementResetInternal,
  startWasteManagementSeedInternal,
  runWasteManagementHolidaySyncInternal,
  updateWasteManagementCityInternal,
  updateWasteManagementCollectionLocationInternal,
  updateWasteManagementFractionInternal,
  updateWasteManagementGlobalDateShiftInternal,
  updateWasteManagementHolidayRuleInternal,
  updateWasteManagementHouseNumberInternal,
  updateWasteManagementLocationTourLinkInternal,
  updateWasteManagementRegionInternal,
  updateWasteManagementSettingsInternal,
  updateWasteManagementStreetInternal,
  updateWasteManagementTourDateShiftInternal,
  updateWasteManagementTourInternal,
} = wasteManagementCoreHandlers;

const actor = createWasteTestActor();

const baseInterfaceRecord = {
  id: 'supabase-1',
  instanceId: 'tenant-a',
  typeKey: 'postgresql' as const,
  ownerKind: 'host' as const,
  ownerId: 'host',
  displayName: 'Waste Supabase',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database' as const,
  statusCheckKind: 'postgresql' as const,
  visibleStatus: 'unknown' as const,
  publicConfig: {
    schemaName: 'public',
    holidayStateCode: 'NW',
    lastHolidaySyncStatus: 'success',
  },
  secretConfigCiphertext: 'cipher-secret',
};

describe('waste-management auth runtime handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T12:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sanitized settings for the authenticated instance', async () => {
    const response = await getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        instanceId: 'tenant-a',
        provider: 'postgresql',
        schemaName: 'public',
        enabled: true,
        selectedInterfaceId: 'supabase-1',
        selectedInterfaceName: 'Waste Supabase',
        selectedInterfaceTypeKey: 'postgresql',
        availableInterfaces: [
          {
            id: 'supabase-1',
            name: 'Waste Supabase',
            typeKey: 'postgresql',
            enabled: true,
            visibleStatus: 'unknown',
            isSelected: true,
          },
        ],
        databaseUrlConfigured: true,
        visibleStatus: 'unknown',
        disruptionLocationEnabled: false,
        disruptionAllLocationsEnabled: false,
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        customRecurrencePresets: [],
      },
      requestId: 'req-test',
    });
  });

  it('returns a read-only waste master-data overview for the authenticated instance', async () => {
    const overview: WasteManagementMasterDataOverview = {
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111111',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      regions: [
        {
          id: 'region-1',
          name: 'Region Mitte',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterstadt',
          regionId: 'region-1',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    };

    const response = await getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadMasterDataOverview: vi.fn(async () => overview),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: overview,
      requestId: 'req-test',
    });
  });

  it('returns the combined waste audit and technical history for the authenticated instance', async () => {
    const response = await getWasteManagementHistoryInternal(
      new Request(
        'https://studio.test/api/v1/waste-management/history?page=2&pageSize=10&q=fraction'
      ),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadWasteHistoryOverview: vi.fn(async () => ({
          audit: {
            items: [
              {
                id: 'log-1',
                actionId: 'waste-management.fraction.created',
                actionNamespace: 'waste-management',
                actionOwner: 'waste-management',
                outcome: 'success',
                occurredAt: '2026-05-09T12:00:00.000Z',
              },
            ],
            total: 1,
          },
          technical: {
            items: [
              {
                id: 'job-1',
                eventType: 'migration.succeeded',
                outcome: 'success',
                occurredAt: '2026-05-09T12:05:00.000Z',
                source: 'job',
                jobId: 'job-1',
                jobTypeId: 'waste-management.apply-migrations',
              },
            ],
            total: 1,
          },
        })),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        audit: {
          items: [
            {
              id: 'log-1',
              actionId: 'waste-management.fraction.created',
              actionNamespace: 'waste-management',
              actionOwner: 'waste-management',
              outcome: 'success',
              occurredAt: '2026-05-09T12:00:00.000Z',
            },
          ],
          total: 1,
        },
        technical: {
          items: [
            {
              id: 'job-1',
              eventType: 'migration.succeeded',
              outcome: 'success',
              occurredAt: '2026-05-09T12:05:00.000Z',
              source: 'job',
              jobId: 'job-1',
              jobTypeId: 'waste-management.apply-migrations',
            },
          ],
          total: 1,
        },
      },
      requestId: 'req-test',
    });
  });

  it('refreshes the visible waste connection status after a successful master-data read', async () => {
    const saveExternalInterfaceConnectionCheck = vi.fn(async () => undefined);
    const overview: WasteManagementMasterDataOverview = {
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    };

    const response = await getWasteManagementMasterDataOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/master-data'),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadMasterDataOverview: vi.fn(async () => overview),
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        saveExternalInterfaceConnectionCheck,
      })
    );

    expect(response.status).toBe(200);
    expect(saveExternalInterfaceConnectionCheck).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      interfaceId: 'supabase-1',
      checkedAt: '2026-05-09T12:30:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
  });

  it('returns a read-only waste tours overview for the authenticated instance', async () => {
    const overview: WasteManagementToursOverview = {
      tours: [
        {
          id: 'tour-1',
          name: 'Restmüll Nord',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          status: 'published',
          locationCount: 12,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };

    const response = await getWasteManagementToursOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/tours'),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadToursOverview: vi.fn(async () => overview),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: overview,
      requestId: 'req-test',
    });
  });

  it('returns a read-only waste scheduling overview for the authenticated instance', async () => {
    const overview: WasteManagementSchedulingOverview = {
      tourDateShifts: [
        {
          id: 'tour-shift-1',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          description: 'Vorverlegt wegen Feiertag',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      globalDateShifts: [
        {
          id: 'global-shift-1',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          description: 'Neujahr',
          tourIds: ['tour-1'],
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      holidayRules: [
        {
          id: 'holiday-rule-1',
          holidayDate: '2026-01-01',
          holidayName: 'Neujahr',
          year: 2026,
          stateCode: 'NW',
          sourceStatus: 'confirmed',
          configurationStatus: 'draft',
          conflictStatus: 'none',
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };

    const response = await getWasteManagementSchedulingOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/scheduling'),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadSchedulingOverview: vi.fn(async () => overview),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: overview,
      requestId: 'req-test',
    });
  });

  it('saves custom recurrence presets through the settings mutation path', async () => {
    const saveExternalInterfaceConnectionCheck = vi.fn(async () => undefined);

    const saveWasteCustomRecurrencePresets = vi.fn(async () => undefined);
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const syncWasteHolidayRules = vi.fn(async () => 'success' as const);
    const loadWasteCustomRecurrencePresets = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'preset-10',
          name: '10 Tage',
          intervalDays: 10,
          createdAt: '2026-05-09T12:20:00.000Z',
          updatedAt: '2026-05-09T12:20:00.000Z',
        },
      ]);
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await updateWasteManagementSettingsInternal(
      createWasteMutationRequest('PUT', 'https://studio.test/api/v1/waste-management/settings', {
        provider: 'postgresql',
        schemaName: 'public',
        enabled: true,
        holidayStateCode: 'NW',
        customRecurrencePresets: [{ id: 'preset-10', name: '10 Tage', intervalDays: 10 }],
        deletedPresetFallbacks: {},
      }),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        saveExternalInterfaceConnectionCheck,
        saveExternalInterfaceRecord,
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        loadWasteCustomRecurrencePresets,
        saveWasteCustomRecurrencePresets,
        syncWasteHolidayRules,
        emitAuditEvent,
      })
    );

    expect(saveWasteCustomRecurrencePresets).toHaveBeenCalledWith('tenant-a', {
      nextItems: [{ id: 'preset-10', name: '10 Tage', intervalDays: 10 }],
      deletedPresetFallbacks: {},
    });
    expect(syncWasteHolidayRules).not.toHaveBeenCalled();
    expect(emitAuditEvent).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        customRecurrencePresets: [{ id: 'preset-10', name: '10 Tage', intervalDays: 10 }],
      },
      requestId: 'req-test',
    });
  });

  it('runs a manual holiday resync through the dedicated settings endpoint', async () => {
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const syncWasteHolidayRules = vi.fn(async () => 'partial_success' as const);

    const response = await runWasteManagementHolidaySyncInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/settings/holiday-sync',
        {}
      ),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        saveExternalInterfaceRecord,
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        loadWasteCustomRecurrencePresets: vi.fn(async () => []),
        syncWasteHolidayRules,
        emitAuditEvent: vi.fn(async () => undefined),
      })
    );

    expect(syncWasteHolidayRules).toHaveBeenCalledWith('tenant-a', 'NW');
    expect(saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        publicConfig: expect.objectContaining({
          holidayStateCode: 'NW',
          lastHolidaySyncStatus: 'partial_success',
          wasteManagementSelected: true,
        }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'partial_success',
      },
      requestId: 'req-test',
    });
  });

  it('creates a waste fraction through the master-data mutation path', async () => {
    const savedFraction: WasteFractionRecord = {
      id: 'fraction-new',
      name: 'Papier',
      pdfShortLabel: 'PAP',
      translations: { de: 'Papier', en: 'Paper' },
      containerSize: '120L',
      color: '#123456',
      description: 'Blaue Tonne',
      active: true,
      reminderConfig: {
        reminderCount: 'twice',
        channels: {
          push: true,
          email: false,
          calendar: true,
        },
        push: {
          slots: [
            { id: 'fraction-new:push:first', maxLeadDays: 10, defaultLeadDays: 1 },
            { id: 'fraction-new:push:second', maxLeadDays: 3, defaultLeadDays: 1 },
          ],
        },
        calendar: {
          slots: [
            { id: 'fraction-new:calendar:first', maxLeadDays: 10, defaultLeadDays: 1 },
            { id: 'fraction-new:calendar:second', maxLeadDays: 3, defaultLeadDays: 1 },
          ],
        },
      },
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteFraction = vi.fn(async () => undefined);
    const loadWasteFractionById = vi.fn(async () => savedFraction);
    const loadMasterDataFractionsOverview = vi.fn(
      async (): Promise<WasteManagementMasterDataOverview> => ({
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      })
    );
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-fraction-create' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await createWasteManagementFractionInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/fractions', {
        id: 'fraction-new',
        name: 'Papier',
        pdfShortLabel: 'pap',
        translations: { de: 'Papier', en: 'Paper' },
        containerSize: '120L',
        color: '#123456',
        description: 'Blaue Tonne',
        active: true,
        reminderConfig: {
          reminderCount: 'twice',
          channels: {
            push: true,
            email: false,
            calendar: true,
          },
          push: {
            slots: [
              { id: 'fraction-new:push:first', maxLeadDays: 10, defaultLeadDays: 1 },
              { id: 'fraction-new:push:second', maxLeadDays: 3, defaultLeadDays: 1 },
            ],
          },
          calendar: {
            slots: [
              { id: 'fraction-new:calendar:first', maxLeadDays: 10, defaultLeadDays: 1 },
              { id: 'fraction-new:calendar:second', maxLeadDays: 3, defaultLeadDays: 1 },
            ],
          },
        },
      }),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        emitAuditEvent,
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
        startPluginOperationJob,
      })
    );

    expect(saveWasteFraction).toHaveBeenCalledWith('tenant-a', {
      id: 'fraction-new',
      name: 'Papier',
      pdfShortLabel: 'PAP',
      translations: { de: 'Papier', en: 'Paper' },
      containerSize: '120L',
      color: '#123456',
      description: 'Blaue Tonne',
      active: true,
      reminderConfig: {
        reminderCount: 'twice',
        channels: {
          push: true,
          email: false,
          calendar: true,
        },
        push: {
          slots: [
            { id: 'fraction-new:push:first', maxLeadDays: 10, defaultLeadDays: 1 },
            { id: 'fraction-new:push:second', maxLeadDays: 3, defaultLeadDays: 1 },
          ],
        },
        calendar: {
          slots: [
            { id: 'fraction-new:calendar:first', maxLeadDays: 10, defaultLeadDays: 1 },
            { id: 'fraction-new:calendar:second', maxLeadDays: 3, defaultLeadDays: 1 },
          ],
        },
      },
    });
    expect(loadWasteFractionById).toHaveBeenCalledWith('tenant-a', 'fraction-new');
    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        actorAccountId: 'account-1',
        endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.sync-waste-types',
          input: {
            operation: 'sync-waste-types',
            keycloakSubject: 'user-1',
            activeOrganizationId: undefined,
          },
        }),
      })
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedFraction,
      syncStatus: 'queued',
      syncJob: { id: 'job-fraction-create' },
      requestId: 'req-test',
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.fraction.created',
          resourceType: 'waste_fraction',
          resourceId: 'fraction-new',
          result: 'success',
        }),
      })
    );
  });

  it('updates a waste fraction through the master-data mutation path', async () => {
    const existingFraction: WasteFractionRecord = {
      id: 'fraction-1',
      name: 'Restmüll',
      pdfShortLabel: 'RES',
      color: '#111111',
      active: true,
      reminderConfig: {
        reminderCount: 'once',
        channels: {
          push: true,
          email: true,
          calendar: false,
        },
        push: {
          slots: [{ id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 }],
        },
        email: {
          slots: [{ id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 }],
        },
      },
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedFraction: WasteFractionRecord = {
      ...existingFraction,
      name: 'Restmüll Plus',
      pdfShortLabel: 'RPL',
      reminderConfig: {
        reminderCount: 'none',
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      },
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteFractionById = vi
      .fn<(_: string, __: string) => Promise<WasteFractionRecord | null>>()
      .mockResolvedValueOnce(existingFraction)
      .mockResolvedValueOnce(updatedFraction);
    const saveWasteFraction = vi.fn(async () => undefined);
    const loadMasterDataFractionsOverview = vi.fn(
      async (): Promise<WasteManagementMasterDataOverview> => ({
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        collectionLocations: [],
        locationTourLinks: [],
      })
    );
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-fraction-update' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const response = await updateWasteManagementFractionInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/fractions/fraction-1',
        {
          name: 'Restmüll Plus',
          pdfShortLabel: 'rpl',
          translations: { de: 'Restmüll Plus', en: 'Residual waste plus' },
          color: '#111111',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: true,
              email: true,
              calendar: true,
            },
            push: {
              slots: [{ id: 'fraction-1:push:first', maxLeadDays: 8, defaultLeadDays: 1 }],
            },
            email: {
              slots: [{ id: 'fraction-1:email:first', maxLeadDays: 8, defaultLeadDays: 1 }],
            },
            calendar: {
              slots: [{ id: 'fraction-1:calendar:first', maxLeadDays: 8, defaultLeadDays: 1 }],
            },
          },
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
        startPluginOperationJob,
      })
    );

    expect(saveWasteFraction).toHaveBeenCalledWith('tenant-a', {
      id: 'fraction-1',
      name: 'Restmüll Plus',
      pdfShortLabel: 'RPL',
      translations: { de: 'Restmüll Plus', en: 'Residual waste plus' },
      containerSize: undefined,
      color: '#111111',
      description: undefined,
      active: true,
      reminderConfig: {
        reminderCount: 'none',
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      },
    });
    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        actorAccountId: 'account-1',
        endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.sync-waste-types',
          input: {
            operation: 'sync-waste-types',
            keycloakSubject: 'user-1',
            activeOrganizationId: undefined,
          },
        }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedFraction,
      syncStatus: 'queued',
      syncJob: { id: 'job-fraction-update' },
      requestId: 'req-test',
    });
  });

  it('creates a waste region through the master-data mutation path', async () => {
    const savedRegion: WasteRegionRecord = {
      id: 'region-new',
      name: 'Region West',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteRegion = vi.fn(async () => undefined);
    const loadWasteRegionById = vi.fn(async () => savedRegion);

    const response = await createWasteManagementRegionInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/regions', {
        id: 'region-new',
        name: 'Region West',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteRegion,
        loadWasteRegionById,
      })
    );

    expect(saveWasteRegion).toHaveBeenCalledWith('tenant-a', {
      id: 'region-new',
      name: 'Region West',
    });
    expect(loadWasteRegionById).toHaveBeenCalledWith('tenant-a', 'region-new');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedRegion,
      requestId: 'req-test',
    });
  });

  it('updates a waste region through the master-data mutation path', async () => {
    const existingRegion: WasteRegionRecord = {
      id: 'region-1',
      name: 'Region Mitte',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedRegion: WasteRegionRecord = {
      ...existingRegion,
      name: 'Region Mitte Plus',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteRegionById = vi
      .fn<(_: string, __: string) => Promise<WasteRegionRecord | null>>()
      .mockResolvedValueOnce(existingRegion)
      .mockResolvedValueOnce(updatedRegion);
    const saveWasteRegion = vi.fn(async () => undefined);

    const response = await updateWasteManagementRegionInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/regions/region-1',
        {
          name: 'Region Mitte Plus',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteRegion,
        loadWasteRegionById,
      })
    );

    expect(saveWasteRegion).toHaveBeenCalledWith('tenant-a', {
      id: 'region-1',
      name: 'Region Mitte Plus',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedRegion,
      requestId: 'req-test',
    });
  });

  it('creates a waste city through the master-data mutation path', async () => {
    const savedCity: WasteCityRecord = {
      id: 'city-new',
      name: 'Musterstadt West',
      regionId: 'region-1',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteCity = vi.fn(async () => undefined);
    const loadWasteCityById = vi.fn(async () => savedCity);

    const response = await createWasteManagementCityInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/cities', {
        id: 'city-new',
        name: 'Musterstadt West',
        regionId: 'region-1',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteCity,
        loadWasteCityById,
      })
    );

    expect(saveWasteCity).toHaveBeenCalledWith('tenant-a', {
      id: 'city-new',
      name: 'Musterstadt West',
      regionId: 'region-1',
    });
    expect(loadWasteCityById).toHaveBeenCalledWith('tenant-a', 'city-new');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedCity,
      requestId: 'req-test',
    });
  });

  it('updates a waste city through the master-data mutation path', async () => {
    const existingCity: WasteCityRecord = {
      id: 'city-1',
      name: 'Musterstadt',
      regionId: 'region-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedCity: WasteCityRecord = {
      ...existingCity,
      name: 'Musterstadt Nord',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteCityById = vi
      .fn<(_: string, __: string) => Promise<WasteCityRecord | null>>()
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(updatedCity);
    const patchWasteCity = vi.fn(async () => undefined);

    const response = await updateWasteManagementCityInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/cities/city-1',
        {
          name: 'Musterstadt Nord',
          regionId: 'region-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        patchWasteCity,
        loadWasteCityById,
      })
    );

    expect(patchWasteCity).toHaveBeenCalledWith('tenant-a', 'city-1', {
      name: 'Musterstadt Nord',
      regionId: 'region-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedCity,
      requestId: 'req-test',
    });
  });

  it('preserves omitted waste city fields during a partial update', async () => {
    const existingCity: WasteCityRecord = {
      id: 'city-1',
      name: 'Musterstadt',
      postalCode: '19336',
      regionId: 'region-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedCity: WasteCityRecord = {
      ...existingCity,
      name: 'Musterstadt Nord',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };
    const loadWasteCityById = vi
      .fn<(_: string, __: string) => Promise<WasteCityRecord | null>>()
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(updatedCity);
    const patchWasteCity = vi.fn(async () => undefined);

    const response = await updateWasteManagementCityInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/cities/city-1',
        { name: 'Musterstadt Nord' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        patchWasteCity,
        loadWasteCityById,
      })
    );

    expect(patchWasteCity).toHaveBeenCalledWith('tenant-a', 'city-1', {
      name: 'Musterstadt Nord',
    });
    expect(response.status).toBe(200);
  });

  it('clears a waste city postal code only when null is explicit', async () => {
    const existingCity: WasteCityRecord = {
      id: 'city-1',
      name: 'Musterstadt',
      postalCode: '19336',
      regionId: 'region-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedCity: WasteCityRecord = {
      ...existingCity,
      postalCode: undefined,
      updatedAt: '2026-05-09T12:30:00.000Z',
    };
    const loadWasteCityById = vi
      .fn<(_: string, __: string) => Promise<WasteCityRecord | null>>()
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(existingCity)
      .mockResolvedValueOnce(updatedCity);
    const patchWasteCity = vi.fn(async () => undefined);

    const response = await updateWasteManagementCityInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/cities/city-1',
        { postalCode: null }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        patchWasteCity,
        loadWasteCityById,
      })
    );

    expect(patchWasteCity).toHaveBeenCalledWith('tenant-a', 'city-1', {
      postalCode: null,
    });
    expect(response.status).toBe(200);
  });

  it('creates a waste street through the master-data mutation path', async () => {
    const savedStreet: WasteStreetRecord = {
      id: 'street-new',
      name: 'Parkweg',
      cityId: 'city-1',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteStreet = vi.fn(async () => undefined);
    const loadWasteStreetById = vi.fn(async () => savedStreet);

    const response = await createWasteManagementStreetInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/streets', {
        id: 'street-new',
        name: 'Parkweg',
        cityId: 'city-1',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteStreet,
        loadWasteStreetById,
      })
    );

    expect(saveWasteStreet).toHaveBeenCalledWith('tenant-a', {
      id: 'street-new',
      name: 'Parkweg',
      cityId: 'city-1',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedStreet,
      requestId: 'req-test',
    });
  });

  it('updates a waste street through the master-data mutation path', async () => {
    const existingStreet: WasteStreetRecord = {
      id: 'street-1',
      name: 'Parkweg',
      cityId: 'city-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedStreet: WasteStreetRecord = {
      ...existingStreet,
      name: 'Parkweg Nord',
      cityId: 'city-1',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteStreetById = vi
      .fn<(_: string, __: string) => Promise<WasteStreetRecord | null>>()
      .mockResolvedValueOnce(existingStreet)
      .mockResolvedValueOnce(existingStreet)
      .mockResolvedValueOnce(updatedStreet);
    const saveWasteStreet = vi.fn(async () => undefined);

    const response = await updateWasteManagementStreetInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/streets/street-1',
        {
          name: 'Parkweg Nord',
          cityId: 'city-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteStreet,
        loadWasteStreetById,
      })
    );

    expect(saveWasteStreet).toHaveBeenCalledWith('tenant-a', {
      id: 'street-1',
      name: 'Parkweg Nord',
      cityId: 'city-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedStreet,
      requestId: 'req-test',
    });
  });

  it('creates a waste house number through the master-data mutation path', async () => {
    const savedHouseNumber: WasteHouseNumberRecord = {
      id: 'house-new',
      number: '14',
      streetId: 'street-1',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteHouseNumber = vi.fn(async () => undefined);
    const loadWasteHouseNumberById = vi.fn(async () => savedHouseNumber);

    const response = await createWasteManagementHouseNumberInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/house-numbers',
        {
          id: 'house-new',
          number: '14',
          streetId: 'street-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
      })
    );

    expect(saveWasteHouseNumber).toHaveBeenCalledWith('tenant-a', {
      id: 'house-new',
      number: '14',
      streetId: 'street-1',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedHouseNumber,
      requestId: 'req-test',
    });
  });

  it('updates a waste house number through the master-data mutation path', async () => {
    const existingHouseNumber: WasteHouseNumberRecord = {
      id: 'house-1',
      number: '14',
      streetId: 'street-1',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedHouseNumber: WasteHouseNumberRecord = {
      ...existingHouseNumber,
      number: '14a',
      streetId: 'street-1',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteHouseNumberById = vi
      .fn<(_: string, __: string) => Promise<WasteHouseNumberRecord | null>>()
      .mockResolvedValueOnce(existingHouseNumber)
      .mockResolvedValueOnce(existingHouseNumber)
      .mockResolvedValueOnce(updatedHouseNumber);
    const saveWasteHouseNumber = vi.fn(async () => undefined);

    const response = await updateWasteManagementHouseNumberInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/house-numbers/house-1',
        {
          number: '14a',
          streetId: 'street-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
      })
    );

    expect(saveWasteHouseNumber).toHaveBeenCalledWith('tenant-a', {
      id: 'house-1',
      number: '14a',
      streetId: 'street-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedHouseNumber,
      requestId: 'req-test',
    });
  });

  it('creates a waste collection location through the master-data mutation path', async () => {
    const savedLocation: WasteCollectionLocationRecord = {
      id: 'location-new',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteCollectionLocation = vi.fn(async () => undefined);
    const loadWasteCollectionLocationById = vi.fn(async () => savedLocation);

    const response = await createWasteManagementCollectionLocationInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/collection-locations',
        {
          id: 'location-new',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    );

    expect(saveWasteCollectionLocation).toHaveBeenCalledWith('tenant-a', {
      id: 'location-new',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedLocation,
      requestId: 'req-test',
    });
  });

  it('updates a waste collection location through the master-data mutation path', async () => {
    const existingLocation: WasteCollectionLocationRecord = {
      id: 'location-1',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-1',
      active: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedLocation: WasteCollectionLocationRecord = {
      ...existingLocation,
      houseNumberId: 'house-2',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteCollectionLocationById = vi
      .fn<(_: string, __: string) => Promise<WasteCollectionLocationRecord | null>>()
      .mockResolvedValueOnce(existingLocation)
      .mockResolvedValueOnce(updatedLocation);
    const saveWasteCollectionLocation = vi.fn(async () => undefined);

    const response = await updateWasteManagementCollectionLocationInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/collection-locations/location-1',
        {
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-2',
          active: true,
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.master-data.manage'], {
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
      })
    );

    expect(saveWasteCollectionLocation).toHaveBeenCalledWith('tenant-a', {
      id: 'location-1',
      cityId: 'city-1',
      regionId: 'region-1',
      streetId: 'street-1',
      houseNumberId: 'house-2',
      active: true,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedLocation,
      requestId: 'req-test',
    });
  });

  it('creates a waste location-tour link through the tours mutation path', async () => {
    const savedLink: WasteLocationTourLinkRecord = {
      id: 'link-new',
      locationId: 'location-1',
      tourId: 'tour-1',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteLocationTourLink = vi.fn(async () => undefined);
    const loadWasteLocationTourLinkById = vi.fn(async () => savedLink);

    const response = await createWasteManagementLocationTourLinkInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/location-tour-links',
        {
          id: 'link-new',
          locationId: 'location-1',
          tourId: 'tour-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    );

    expect(saveWasteLocationTourLink).toHaveBeenCalledWith('tenant-a', {
      id: 'link-new',
      locationId: 'location-1',
      tourId: 'tour-1',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedLink,
      requestId: 'req-test',
    });
  });

  it('updates a waste location-tour link through the tours mutation path', async () => {
    const existingLink: WasteLocationTourLinkRecord = {
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedLink: WasteLocationTourLinkRecord = {
      ...existingLink,
      endDate: '2026-12-31',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteLocationTourLinkById = vi
      .fn<(_: string, __: string) => Promise<WasteLocationTourLinkRecord | null>>()
      .mockResolvedValueOnce(existingLink)
      .mockResolvedValueOnce(updatedLink);
    const saveWasteLocationTourLink = vi.fn(async () => undefined);

    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await updateWasteManagementLocationTourLinkInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/location-tour-links/link-1',
        {
          locationId: 'location-1',
          tourId: 'tour-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        emitAuditEvent,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    );

    expect(saveWasteLocationTourLink).toHaveBeenCalledWith('tenant-a', {
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedLink,
      requestId: 'req-test',
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.location-tour-link.updated',
          resourceType: 'waste_location_tour_link',
          resourceId: 'link-1',
          result: 'success',
        }),
      })
    );
  });

  it('deletes a waste location-tour link through the tours mutation path', async () => {
    const existingLink: WasteLocationTourLinkRecord = {
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };

    const loadWasteLocationTourLinkById = vi.fn(async () => existingLink);
    const deleteWasteLocationTourLink = vi.fn(async () => undefined);
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await deleteWasteManagementLocationTourLinkInternal(
      createWasteMutationRequest(
        'DELETE',
        'https://studio.test/api/v1/waste-management/location-tour-links/link-1'
      ),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        emitAuditEvent,
        deleteWasteLocationTourLink,
        loadWasteLocationTourLinkById,
      })
    );

    expect(deleteWasteLocationTourLink).toHaveBeenCalledWith('tenant-a', 'link-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { id: 'link-1' },
      requestId: 'req-test',
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.location-tour-link.deleted',
          resourceType: 'waste_location_tour_link',
          resourceId: 'link-1',
          result: 'success',
        }),
      })
    );
  });

  it('creates a waste tour through the tours mutation path', async () => {
    const savedTour: WasteTourRecord = {
      id: 'tour-new',
      name: 'Papier Mitte',
      description: 'Zweiwöchentliche Tour',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      firstDate: '2026-05-19',
      customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
      status: 'draft',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => savedTour);

    const response = await createWasteManagementTourInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
        id: 'tour-new',
        name: 'Papier Mitte',
        description: 'Zweiwöchentliche Tour',
        wasteFractionIds: ['fraction-2'],
        recurrence: 'biweekly',
        firstDate: '2026-05-19',
        customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
        status: 'draft',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteTour,
        loadWasteTourById,
      })
    );

    expect(saveWasteTour).toHaveBeenCalledWith('tenant-a', {
      id: 'tour-new',
      name: 'Papier Mitte',
      description: 'Zweiwöchentliche Tour',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      customRecurrenceId: undefined,
      firstDate: '2026-05-19',
      endDate: undefined,
      customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
      status: 'draft',
      locationCount: undefined,
    });
    expect(loadWasteTourById).toHaveBeenCalledWith('tenant-a', 'tour-new');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedTour,
      requestId: 'req-test',
    });
  });

  it('duplicates all tour contents after creating a duplicated waste tour', async () => {
    const savedTour: WasteTourRecord = {
      id: 'tour-copy-1',
      name: 'Papier Mitte (Kopie)',
      description: 'Zweiwöchentliche Tour',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      firstDate: '2026-05-19',
      customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
      status: 'draft',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };
    const sourceLinks: readonly WasteLocationTourLinkRecord[] = [
      {
        id: 'link-source-1',
        locationId: 'location-1',
        tourId: 'tour-source-1',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ];
    const sourceShifts: readonly WasteTourDateShiftRecord[] = [
      {
        id: 'shift-source-1',
        tourId: 'tour-source-1',
        originalDate: '2026-12-24',
        actualDate: '2026-12-23',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'xmas-eve',
        followUpMode: 'move_forward',
        description: 'Vorverlegung',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ];
    const sourcePickupDates = [
      {
        id: 'pickup-source-1',
        locationId: 'location-1',
        tourId: 'tour-source-1',
        pickupDate: '2026-06-02',
        note: 'Seiteneingang',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ] as const;
    const sourceTourAssignments = [
      {
        id: 'assignment-source-1',
        tourId: 'tour-source-1',
        pickupDate: '2026-06-03',
        note: 'Sammelplatz',
        locationIds: ['location-1'],
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ] as const;

    const sourceTour: WasteTourRecord = { ...savedTour, id: 'tour-source-1', status: 'published' };
    const sourceBefore = structuredClone({
      sourceTour,
      sourceLinks,
      sourcePickupDates,
      sourceTourAssignments,
      sourceShifts,
    });
    const storedTours = new Map([[sourceTour.id, sourceTour]]);
    const saveWasteTour = vi.fn(
      async (_instanceId: string, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) => {
        storedTours.set(input.id, {
          ...input,
          createdAt: savedTour.createdAt,
          updatedAt: savedTour.updatedAt,
        });
      }
    );
    const loadWasteTourById = vi.fn(
      async (_instanceId: string, id: string) => storedTours.get(id) ?? null
    );
    const listWasteLocationTourLinksByTourId = vi.fn(async () => sourceLinks);
    const saveWasteLocationTourLink = vi.fn(async () => undefined);
    const listWasteLocationTourPickupDates = vi.fn(async () => sourcePickupDates);
    const saveWasteLocationTourPickupDate = vi.fn(async () => undefined);
    const listWasteTourAssignments = vi.fn(async () => sourceTourAssignments);
    const saveWasteTourAssignment = vi.fn(async () => undefined);
    const listWasteTourDateShiftsByTourId = vi.fn(async () => sourceShifts);
    const saveWasteTourDateShift = vi.fn(async () => undefined);
    const deleteWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
        id: 'tour-copy-1',
        name: 'Papier Mitte (Kopie)',
        description: 'Zweiwöchentliche Tour',
        wasteFractionIds: ['fraction-2'],
        recurrence: 'biweekly',
        firstDate: '2026-05-19',
        customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
        duplicateFromTourId: 'tour-source-1',
        status: 'draft',
      }),
      actor,
      createWasteHandlerDeps(
        ['waste-management.tours.manage', 'waste-management.scheduling.manage'],
        {
          saveWasteTour,
          loadWasteTourById,
          listWasteLocationTourLinksByTourId,
          saveWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          saveWasteLocationTourPickupDate,
          listWasteTourAssignments,
          saveWasteTourAssignment,
          listWasteTourDateShiftsByTourId,
          saveWasteTourDateShift,
          deleteWasteTour,
        }
      )
    );

    expect(listWasteLocationTourLinksByTourId).toHaveBeenCalledWith('tenant-a', 'tour-source-1');
    expect(saveWasteLocationTourLink).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-copy-1',
      })
    );
    expect(listWasteLocationTourPickupDates).toHaveBeenCalledWith('tenant-a', {
      tourId: 'tour-source-1',
    });
    expect(saveWasteLocationTourPickupDate).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-copy-1',
        pickupDate: '2026-06-02',
        note: 'Seiteneingang',
      })
    );
    expect(listWasteTourAssignments).toHaveBeenCalledWith('tenant-a', {
      tourId: 'tour-source-1',
    });
    expect(saveWasteTourAssignment).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        tourId: 'tour-copy-1',
        pickupDate: '2026-06-03',
        note: 'Sammelplatz',
        locationIds: ['location-1'],
      })
    );
    expect(listWasteTourDateShiftsByTourId).toHaveBeenCalledWith('tenant-a', 'tour-source-1');
    expect(saveWasteTourDateShift).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        tourId: 'tour-copy-1',
        originalDate: '2026-12-24',
        actualDate: '2026-12-23',
        hasYear: true,
        reasonType: 'holiday',
        reasonKey: 'xmas-eve',
        followUpMode: 'move_forward',
        description: 'Vorverlegung',
      })
    );
    expect(deleteWasteTour).not.toHaveBeenCalled();
    expect(saveWasteTour).toHaveBeenCalledTimes(1);
    expect(saveWasteTour).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        id: 'tour-copy-1',
        wasteFractionIds: ['fraction-2'],
        recurrence: 'biweekly',
        firstDate: '2026-05-19',
        customDates: savedTour.customDates,
        status: 'draft',
      })
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ data: savedTour });
    expect(storedTours.get(sourceTour.id)).toEqual(sourceBefore.sourceTour);
    expect({
      sourceTour,
      sourceLinks,
      sourcePickupDates,
      sourceTourAssignments,
      sourceShifts,
    }).toEqual(sourceBefore);
    expect(storedTours.size).toBe(2);
  });

  it.each([
    ['aaaaaaaa-1111-4111-8111-111111111111', 400],
    ['  aaaaaaaa-1111-4111-8111-111111111111  ', 400],
    ['AAAAAAAA-1111-4111-8111-111111111111', 400],
    ['{aaaaaaaa-1111-4111-8111-111111111111}', 400],
    ['aaaaaaaa111141118111111111111111', 400],
    ['bbbbbbbb-2222-4222-8222-222222222222', 409],
  ] as const)(
    'rejects duplication onto an existing tour ID %s before any write or rollback',
    async (targetId, expectedStatus) => {
      const source: WasteTourRecord = {
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        name: 'TEST Quelle',
        wasteFractionIds: ['fraction-2'],
        recurrence: 'weekly',
        firstDate: '2026-05-19',
        status: 'published',
        createdAt: '2026-05-09T12:00:00.000Z',
        updatedAt: '2026-05-09T12:00:00.000Z',
      };
      const storedTours = new Map([[source.id, structuredClone(source)]]);
      if (expectedStatus === 409) {
        storedTours.set(targetId, { ...source, id: targetId, name: 'TEST Andere Tour' });
      }
      const storedBefore = structuredClone(storedTours);
      const saveWasteTour = vi.fn(
        async (_instanceId: string, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) => {
          storedTours.set(input.id, { ...source, ...input });
        }
      );
      const deleteWasteTour = vi.fn(async (_instanceId: string, id: string) => {
        storedTours.delete(id);
      });
      const saveWasteLocationTourLink = vi.fn(async () => {
        throw new Error('TEST copy failed');
      });
      const response = await createWasteManagementTourInternal(
        createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
          id: targetId,
          duplicateFromTourId: source.id,
          name: 'TEST Kopie',
          wasteFractionIds: source.wasteFractionIds,
          recurrence: source.recurrence,
          firstDate: source.firstDate,
          status: 'draft',
        }),
        actor,
        createWasteHandlerDeps(
          ['waste-management.tours.manage', 'waste-management.scheduling.manage'],
          {
            saveWasteTour,
            deleteWasteTour,
            loadWasteTourById: vi.fn(
              async (_instanceId: string, id: string) => storedTours.get(id) ?? null
            ),
            listWasteLocationTourLinksByTourId: vi.fn(async () => [
              {
                id: 'link-source',
                locationId: 'location-1',
                tourId: source.id,
                createdAt: source.createdAt,
                updatedAt: source.updatedAt,
              },
            ]),
            listWasteLocationTourPickupDates: vi.fn(async () => []),
            listWasteTourAssignments: vi.fn(async () => []),
            listWasteTourDateShiftsByTourId: vi.fn(async () => []),
            saveWasteLocationTourLink,
          }
        )
      );
      expect.soft(response.status).toBe(expectedStatus);
      expect.soft(saveWasteTour).not.toHaveBeenCalled();
      expect.soft(saveWasteLocationTourLink).not.toHaveBeenCalled();
      expect.soft(deleteWasteTour).not.toHaveBeenCalled();
      expect.soft(storedTours).toEqual(storedBefore);
    }
  );

  it('rejects duplicated waste tour creation without scheduling permission', async () => {
    const saveWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
        id: 'tour-copy-2',
        name: 'Papier Mitte (Kopie)',
        wasteFractionIds: ['fraction-2'],
        duplicateFromTourId: 'tour-source-1',
        status: 'draft',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteTour,
      })
    );

    expect(response.status).toBe(403);
    expect(saveWasteTour).not.toHaveBeenCalled();
  });

  it('rolls back the created waste tour when duplicated relation copying fails', async () => {
    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => null);
    const listWasteLocationTourLinksByTourId = vi.fn(
      async () =>
        [
          {
            id: 'link-source-1',
            locationId: 'location-1',
            tourId: 'tour-source-1',
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ] satisfies readonly WasteLocationTourLinkRecord[]
    );
    const saveWasteLocationTourLink = vi.fn(async () => {
      throw new Error('copy_failed');
    });
    const listWasteTourDateShiftsByTourId = vi.fn(async () => []);
    const listWasteLocationTourPickupDates = vi.fn(async () => []);
    const listWasteTourAssignments = vi.fn(async () => []);
    const deleteWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
        id: 'tour-copy-3',
        name: 'Papier Mitte (Kopie)',
        wasteFractionIds: ['fraction-2'],
        duplicateFromTourId: 'tour-source-1',
        status: 'draft',
      }),
      actor,
      createWasteHandlerDeps(
        ['waste-management.tours.manage', 'waste-management.scheduling.manage'],
        {
          saveWasteTour,
          loadWasteTourById,
          listWasteLocationTourLinksByTourId,
          saveWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          listWasteTourAssignments,
          listWasteTourDateShiftsByTourId,
          deleteWasteTour,
        }
      )
    );

    expect(deleteWasteTour).toHaveBeenCalledWith('tenant-a', 'tour-copy-3');
    expect(response.status).toBe(503);
  });

  it('updates a waste tour through the tours mutation path', async () => {
    const existingTour: WasteTourRecord = {
      id: 'tour-1',
      name: 'Restmüll Nord',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      firstDate: '2026-05-12',
      status: 'published',
      locationCount: 12,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedTour: WasteTourRecord = {
      ...existingTour,
      name: 'Restmüll Nord Plus',
      description: 'Angepasste Route',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteTourById = vi
      .fn<(_: string, __: string) => Promise<WasteTourRecord | null>>()
      .mockResolvedValueOnce(existingTour)
      .mockResolvedValueOnce(updatedTour);
    const saveWasteTour = vi.fn(async () => undefined);

    const response = await updateWasteManagementTourInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/tours/tour-1',
        {
          name: 'Restmüll Nord Plus',
          description: 'Angepasste Route',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          status: 'archived',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteTour,
        loadWasteTourById,
      })
    );

    expect(saveWasteTour).toHaveBeenCalledWith('tenant-a', {
      id: 'tour-1',
      name: 'Restmüll Nord Plus',
      description: 'Angepasste Route',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      customRecurrenceId: undefined,
      firstDate: '2026-05-12',
      endDate: undefined,
      customDates: undefined,
      status: 'archived',
      locationCount: 12,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedTour,
      requestId: 'req-test',
    });
  });

  it('normalizes tour writes to customRecurrenceId when a custom preset is selected', async () => {
    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => ({
      id: 'tour-custom',
      name: 'Papier Intervall',
      wasteFractionIds: ['fraction-2'],
      recurrence: null,
      customRecurrenceId: 'preset-10',
      status: 'draft',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    }));

    const response = await createWasteManagementTourInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/tours', {
        id: 'tour-custom',
        name: 'Papier Intervall',
        wasteFractionIds: ['fraction-2'],
        recurrence: 'weekly',
        customRecurrenceId: 'preset-10',
        firstDate: '2026-05-19',
        status: 'draft',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteTour,
        loadWasteTourById,
      })
    );

    expect(saveWasteTour).toHaveBeenCalledWith('tenant-a', {
      id: 'tour-custom',
      name: 'Papier Intervall',
      description: undefined,
      wasteFractionIds: ['fraction-2'],
      recurrence: null,
      customRecurrenceId: 'preset-10',
      firstDate: '2026-05-19',
      endDate: undefined,
      customDates: undefined,
      status: 'draft',
      locationCount: undefined,
    });
    expect(response.status).toBe(201);
  });

  it('creates a tour-related waste date shift through the scheduling mutation path', async () => {
    const savedShift: WasteTourDateShiftRecord = {
      id: 'shift-new',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'propagate-series',
      description: 'Vorverlegt',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const createWasteTourDateShift = vi.fn(async () => undefined);
    const loadWasteTourDateShiftById = vi.fn(async () => savedShift);

    const response = await createWasteManagementTourDateShiftInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tour-date-shifts',
        {
          id: 'shift-new',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'propagate-series',
          description: 'Vorverlegt',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.scheduling.manage'], {
        createWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    );

    expect(createWasteTourDateShift).toHaveBeenCalledWith('tenant-a', {
      id: 'shift-new',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'propagate-series',
      description: 'Vorverlegt',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedShift,
      requestId: 'req-test',
    });
  });

  it('updates a tour-related waste date shift through the scheduling mutation path', async () => {
    const existingShift: WasteTourDateShiftRecord = {
      id: 'shift-1',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-23',
      hasYear: true,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedShift: WasteTourDateShiftRecord = {
      ...existingShift,
      actualDate: '2026-12-22',
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'mark-follow-up-dates',
      description: 'Stärker vorverlegt',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteTourDateShiftById = vi
      .fn<(_: string, __: string) => Promise<WasteTourDateShiftRecord | null>>()
      .mockResolvedValueOnce(existingShift)
      .mockResolvedValueOnce(updatedShift);
    const saveWasteTourDateShift = vi.fn(async () => undefined);

    const response = await updateWasteManagementTourDateShiftInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/tour-date-shifts/shift-1',
        {
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-22',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'mark-follow-up-dates',
          description: 'Stärker vorverlegt',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.scheduling.manage'], {
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
      })
    );

    expect(saveWasteTourDateShift).toHaveBeenCalledWith('tenant-a', {
      id: 'shift-1',
      tourId: 'tour-1',
      originalDate: '2026-12-24',
      actualDate: '2026-12-22',
      hasYear: true,
      reasonType: 'manual-adjustment',
      reasonKey: 'xmas-pull-forward',
      followUpMode: 'mark-follow-up-dates',
      description: 'Stärker vorverlegt',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedShift,
      requestId: 'req-test',
    });
  });

  it('creates a global waste date shift through the scheduling mutation path', async () => {
    const savedShift: WasteGlobalDateShiftRecord = {
      id: 'global-shift-new',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'new-year',
      description: 'Neujahr',
      tourIds: ['tour-1'],
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteGlobalDateShift = vi.fn(async () => undefined);
    const loadWasteGlobalDateShiftById = vi.fn(async () => savedShift);

    const response = await createWasteManagementGlobalDateShiftInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/global-date-shifts',
        {
          id: 'global-shift-new',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'new-year',
          description: 'Neujahr',
          tourIds: ['tour-1'],
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.scheduling.manage'], {
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    );

    expect(saveWasteGlobalDateShift).toHaveBeenCalledWith('tenant-a', {
      id: 'global-shift-new',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      reasonType: 'holiday',
      reasonKey: 'new-year',
      description: 'Neujahr',
      tourIds: ['tour-1'],
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedShift,
      requestId: 'req-test',
    });
  });

  it('updates a global waste date shift through the scheduling mutation path', async () => {
    const existingShift: WasteGlobalDateShiftRecord = {
      id: 'global-shift-1',
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      tourIds: ['tour-1'],
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
    };
    const updatedShift: WasteGlobalDateShiftRecord = {
      ...existingShift,
      actualDate: '2026-01-03',
      reasonType: 'global-deviation',
      reasonKey: 'holiday-backlog',
      tourIds: ['tour-1', 'tour-2'],
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteGlobalDateShiftById = vi
      .fn<(_: string, __: string) => Promise<WasteGlobalDateShiftRecord | null>>()
      .mockResolvedValueOnce(existingShift)
      .mockResolvedValueOnce(updatedShift);
    const saveWasteGlobalDateShift = vi.fn(async () => undefined);

    const response = await updateWasteManagementGlobalDateShiftInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/global-date-shifts/global-shift-1',
        {
          originalDate: '2026-01-01',
          actualDate: '2026-01-03',
          hasYear: true,
          reasonType: 'global-deviation',
          reasonKey: 'holiday-backlog',
          tourIds: ['tour-1', 'tour-2'],
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.scheduling.manage'], {
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
      })
    );

    expect(saveWasteGlobalDateShift).toHaveBeenCalledWith('tenant-a', {
      id: 'global-shift-1',
      originalDate: '2026-01-01',
      actualDate: '2026-01-03',
      hasYear: true,
      reasonType: 'global-deviation',
      reasonKey: 'holiday-backlog',
      description: undefined,
      tourIds: ['tour-1', 'tour-2'],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedShift,
      requestId: 'req-test',
    });
  });

  it('updates a holiday rule through the scheduling mutation path', async () => {
    const existingRule: WasteHolidayRuleRecord = {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'draft',
      conflictStatus: 'none',
      createdAt: '2026-05-10T10:00:00.000Z',
      updatedAt: '2026-05-10T10:00:00.000Z',
    };
    const updatedRule: WasteHolidayRuleRecord = {
      ...existingRule,
      scope: 'holiday-only',
      strategy: 'advance',
      configurationStatus: 'configured',
      updatedAt: '2026-05-10T10:30:00.000Z',
    };

    const loadWasteHolidayRuleById = vi
      .fn<(_: string, __: string) => Promise<WasteHolidayRuleRecord | null>>()
      .mockResolvedValueOnce(existingRule)
      .mockResolvedValueOnce(updatedRule);
    const saveWasteHolidayRule = vi.fn(async () => undefined);

    const response = await updateWasteManagementHolidayRuleInternal(
      createWasteMutationRequest(
        'PUT',
        'https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1',
        {
          scope: 'holiday-only',
          strategy: 'advance',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.scheduling.manage'], {
        saveWasteHolidayRule,
        loadWasteHolidayRuleById,
      })
    );

    expect(saveWasteHolidayRule).toHaveBeenCalledWith('tenant-a', {
      id: 'holiday-rule-1',
      holidayDate: '2026-01-01',
      holidayName: 'Neujahr',
      year: 2026,
      stateCode: 'NW',
      sourceStatus: 'confirmed',
      configurationStatus: 'configured',
      conflictStatus: 'none',
      scope: 'holiday-only',
      strategy: 'advance',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedRule,
      requestId: 'req-test',
    });
  });

  it('returns verification_failed responses for newly created waste entities when the read-after-write lookup misses', async () => {
    const cases = [
      {
        label: 'street',
        handler: createWasteManagementStreetInternal,
        url: 'https://studio.test/api/v1/waste-management/streets',
        permission: 'waste-management.master-data.manage',
        deps: {
          saveWasteStreet: vi.fn(async () => undefined),
          loadWasteStreetById: vi.fn(async () => null),
        },
        body: {
          id: 'street-fail',
          name: 'Nebenstraße',
          cityId: 'city-1',
        },
      },
      {
        label: 'collection-location',
        handler: createWasteManagementCollectionLocationInternal,
        url: 'https://studio.test/api/v1/waste-management/collection-locations',
        permission: 'waste-management.master-data.manage',
        deps: {
          saveWasteCollectionLocation: vi.fn(async () => undefined),
          loadWasteCollectionLocationById: vi.fn(async () => null),
        },
        body: {
          id: 'location-fail',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
        },
      },
      {
        label: 'location-tour-link',
        handler: createWasteManagementLocationTourLinkInternal,
        url: 'https://studio.test/api/v1/waste-management/location-tour-links',
        permission: 'waste-management.tours.manage',
        deps: {
          saveWasteLocationTourLink: vi.fn(async () => undefined),
          loadWasteLocationTourLinkById: vi.fn(async () => null),
        },
        body: {
          id: 'link-fail',
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
        },
      },
      {
        label: 'tour',
        handler: createWasteManagementTourInternal,
        url: 'https://studio.test/api/v1/waste-management/tours',
        permission: 'waste-management.tours.manage',
        deps: {
          saveWasteTour: vi.fn(async () => undefined),
          loadWasteTourById: vi.fn(async () => null),
        },
        body: {
          id: 'tour-fail',
          name: 'Fehlerhafte Tour',
          wasteFractionIds: ['fraction-1'],
          status: 'draft',
        },
      },
      {
        label: 'tour-date-shift',
        handler: createWasteManagementTourDateShiftInternal,
        url: 'https://studio.test/api/v1/waste-management/tour-date-shifts',
        permission: 'waste-management.scheduling.manage',
        deps: {
          createWasteTourDateShift: vi.fn(async () => undefined),
          loadWasteTourDateShiftById: vi.fn(async () => null),
        },
        body: {
          id: 'shift-fail',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
        },
      },
      {
        label: 'global-date-shift',
        handler: createWasteManagementGlobalDateShiftInternal,
        url: 'https://studio.test/api/v1/waste-management/global-date-shifts',
        permission: 'waste-management.scheduling.manage',
        deps: {
          saveWasteGlobalDateShift: vi.fn(async () => undefined),
          loadWasteGlobalDateShiftById: vi.fn(async () => null),
        },
        body: {
          id: 'global-shift-fail',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          tourIds: ['tour-1'],
        },
      },
    ] as const;

    for (const testCase of cases) {
      const response = await testCase.handler(
        createWasteMutationRequest('POST', testCase.url, testCase.body),
        actor,
        createWasteHandlerDeps([testCase.permission], {
          getRequestId: () => `req-${testCase.label}`,
          ...testCase.deps,
        })
      );

      expect(response.status, testCase.label).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'database_unavailable',
          message: expect.any(String),
        },
        requestId: `req-${testCase.label}`,
      });
    }
  });

  it('returns database_unavailable responses for waste updates when persistence throws after validation', async () => {
    const failingSave = vi.fn(async () => {
      throw new Error('db_down');
    });

    const cases = [
      {
        label: 'street',
        handler: updateWasteManagementStreetInternal,
        url: 'https://studio.test/api/v1/waste-management/streets/street-1',
        permission: 'waste-management.master-data.manage',
        deps: {
          saveWasteStreet: failingSave,
          loadWasteStreetById: vi.fn(async () => ({
            id: 'street-1',
            name: 'Hauptstraße',
            cityId: 'city-1',
          })),
        },
        body: { name: 'Hauptstraße Nord', cityId: 'city-1' },
      },
      {
        label: 'house-number',
        handler: updateWasteManagementHouseNumberInternal,
        url: 'https://studio.test/api/v1/waste-management/house-numbers/house-1',
        permission: 'waste-management.master-data.manage',
        deps: {
          saveWasteHouseNumber: failingSave,
          loadWasteHouseNumberById: vi.fn(async () => ({
            id: 'house-1',
            number: '12',
            streetId: 'street-1',
          })),
        },
        body: { number: '14', streetId: 'street-1' },
      },
      {
        label: 'collection-location',
        handler: updateWasteManagementCollectionLocationInternal,
        url: 'https://studio.test/api/v1/waste-management/collection-locations/location-1',
        permission: 'waste-management.master-data.manage',
        deps: {
          saveWasteCollectionLocation: failingSave,
          loadWasteCollectionLocationById: vi.fn(async () => ({
            id: 'location-1',
            cityId: 'city-1',
            regionId: 'region-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          })),
        },
        body: {
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-2',
          active: true,
        },
      },
      {
        label: 'location-tour-link',
        handler: updateWasteManagementLocationTourLinkInternal,
        url: 'https://studio.test/api/v1/waste-management/location-tour-links/link-1',
        permission: 'waste-management.tours.manage',
        deps: {
          saveWasteLocationTourLink: failingSave,
          loadWasteLocationTourLinkById: vi.fn(async () => ({
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            startDate: '2026-05-01',
          })),
        },
        body: {
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          endDate: '2026-12-31',
        },
      },
      {
        label: 'tour',
        handler: updateWasteManagementTourInternal,
        url: 'https://studio.test/api/v1/waste-management/tours/tour-1',
        permission: 'waste-management.tours.manage',
        deps: {
          saveWasteTour: failingSave,
          loadWasteTourById: vi.fn(async () => ({
            id: 'tour-1',
            name: 'Restmüll Nord',
            wasteFractionIds: ['fraction-1'],
            status: 'published',
            locationCount: 2,
          })),
        },
        body: {
          name: 'Restmüll Nord Plus',
          wasteFractionIds: ['fraction-1'],
          status: 'archived',
        },
      },
      {
        label: 'tour-date-shift',
        handler: updateWasteManagementTourDateShiftInternal,
        url: 'https://studio.test/api/v1/waste-management/tour-date-shifts/shift-1',
        permission: 'waste-management.scheduling.manage',
        deps: {
          saveWasteTourDateShift: failingSave,
          loadWasteTourDateShiftById: vi.fn(async () => ({
            id: 'shift-1',
            tourId: 'tour-1',
            originalDate: '2026-12-24',
            actualDate: '2026-12-23',
            hasYear: true,
          })),
        },
        body: {
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-22',
          hasYear: true,
        },
      },
      {
        label: 'global-date-shift',
        handler: updateWasteManagementGlobalDateShiftInternal,
        url: 'https://studio.test/api/v1/waste-management/global-date-shifts/global-shift-1',
        permission: 'waste-management.scheduling.manage',
        deps: {
          saveWasteGlobalDateShift: failingSave,
          loadWasteGlobalDateShiftById: vi.fn(async () => ({
            id: 'global-shift-1',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            hasYear: true,
            tourIds: ['tour-1'],
          })),
        },
        body: {
          originalDate: '2026-01-01',
          actualDate: '2026-01-03',
          hasYear: true,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const response = await testCase.handler(
        createWasteMutationRequest('PUT', testCase.url, testCase.body),
        actor,
        createWasteHandlerDeps([testCase.permission], {
          getRequestId: () => `req-${testCase.label}`,
          ...testCase.deps,
        })
      );

      expect(response.status, testCase.label).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'database_unavailable',
          message: expect.any(String),
        },
        requestId: `req-${testCase.label}`,
      });
    }
  });

  it('starts the waste migrations job through the generic plugin operations pipeline', async () => {
    const startJob = vi.fn(
      async () => new Response(JSON.stringify({ data: { id: 'job-1' } }), { status: 202 })
    );

    const response = await startWasteManagementMigrationsInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/migrations',
        {
          targetSchema: 'wm',
          requestedByVersion: '2026.05.0',
        },
        { 'Idempotency-Key': 'idem-1' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
      })
    );

    expect(startJob).toHaveBeenCalledWith({
      actorAccountId: 'account-1',
      data: {
        input: {
          operation: 'apply-migrations',
          requestedByVersion: '2026.05.0',
          targetSchema: 'wm',
        },
        jobTypeId: 'waste-management.apply-migrations',
        pluginId: 'waste-management',
      },
      endpoint: 'POST:/api/v1/waste-management/tools/migrations',
      idempotencyKey: 'idem-1',
      instanceId: 'tenant-a',
      requestId: 'req-test',
      scheduledAt: '2026-05-09T12:30:00.000Z',
    });
    expect(response.status).toBe(202);
  });

  it('starts the waste initialization job through the generic plugin operations pipeline', async () => {
    const startJob = vi.fn(
      async () => new Response(JSON.stringify({ data: { id: 'job-init-1' } }), { status: 202 })
    );

    const response = await startWasteManagementInitializeInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/initialize',
        {
          targetSchema: 'wm',
        },
        { 'Idempotency-Key': 'idem-0' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
      })
    );

    expect(startJob).toHaveBeenCalledWith({
      actorAccountId: 'account-1',
      data: {
        input: {
          operation: 'initialize-data-source',
          targetSchema: 'wm',
        },
        jobTypeId: 'waste-management.initialize-data-source',
        pluginId: 'waste-management',
      },
      endpoint: 'POST:/api/v1/waste-management/tools/initialize',
      idempotencyKey: 'idem-0',
      instanceId: 'tenant-a',
      requestId: 'req-test',
      scheduledAt: '2026-05-09T12:30:00.000Z',
    });
    expect(response.status).toBe(202);
  });

  it('rejects waste tool starts when the requested schema differs from the configured instance schema', async () => {
    const startJob = vi.fn();

    const response = await startWasteManagementMigrationsInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/migrations',
        {
          targetSchema: 'other_schema',
        },
        { 'Idempotency-Key': 'idem-2' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.settings.manage'], {
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
      requestId: 'req-test',
    });
    expect(startJob).not.toHaveBeenCalled();
  });

  it('creates waste location-tour links in bulk through the dedicated bulk endpoint', async () => {
    const saveWasteLocationTourLinksBulk = vi.fn(async () => [
      {
        id: 'link-10',
        locationId: 'location-1',
        tourId: 'tour-1',
        startDate: '2026-05-01',
        endDate: undefined,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
      {
        id: 'link-11',
        locationId: 'location-2',
        tourId: 'tour-1',
        startDate: '2026-05-01',
        endDate: undefined,
        createdAt: '2026-05-09T10:00:00.000Z',
        updatedAt: '2026-05-09T10:00:00.000Z',
      },
    ]);

    const response = await createWasteManagementLocationTourLinksBulkInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/location-tour-links/bulk',
        {
          locationIds: ['location-1', 'location-2'],
          tourId: 'tour-1',
        }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.tours.manage'], {
        saveWasteLocationTourLinksBulk,
      })
    );

    expect(saveWasteLocationTourLinksBulk).toHaveBeenCalledWith('tenant-a', {
      locationIds: ['location-1', 'location-2'],
      tourId: 'tour-1',
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        createdCount: 2,
        items: [
          expect.objectContaining({ id: 'link-10', locationId: 'location-1', tourId: 'tour-1' }),
          expect.objectContaining({ id: 'link-11', locationId: 'location-2', tourId: 'tour-1' }),
        ],
      },
      requestId: 'req-test',
    });
  });

  it('starts the waste import job through the generic plugin operations pipeline', async () => {
    const startJob = vi.fn(
      async () => new Response(JSON.stringify({ data: { id: 'job-import-1' } }), { status: 202 })
    );

    const response = await startWasteManagementImportInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/imports',
        {
          importProfileId: 'waste-management.geografie-abholorte',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blobRef: 'plugin-operation-input:00000000-0000-4000-8000-000000000001',
          dryRun: true,
        },
        { 'Idempotency-Key': 'idem-1' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.import.execute'], {
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => wasteResolvedActorInfo),
      })
    );

    expect(startJob).toHaveBeenCalledWith({
      actorAccountId: 'account-1',
      data: {
        input: {
          operation: 'import-data',
          importProfileId: 'waste-management.geografie-abholorte',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dryRun: true,
          blobRef: 'plugin-operation-input:00000000-0000-4000-8000-000000000001',
        },
        jobTypeId: 'waste-management.import-data',
        pluginId: 'waste-management',
      },
      endpoint: 'POST:/api/v1/waste-management/tools/imports',
      idempotencyKey: 'idem-1',
      instanceId: 'tenant-a',
      requestId: 'req-test',
      scheduledAt: '2026-05-09T12:30:00.000Z',
    });
    expect(response.status).toBe(202);
  });

  it('rejects malformed reset payloads before starting a job', async () => {
    const response = await startWasteManagementResetInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/reset',
        {},
        { 'Idempotency-Key': 'idem-1' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.reset.execute'], {
        startPluginOperationJob: vi.fn(),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
      },
    });
  });

  it('rejects settings access when the specific waste permission is missing', async () => {
    const loadDefaultInterfaceRecord = vi.fn(async () => baseInterfaceRecord);

    const response = await getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        loadDefaultInterfaceRecord,
      })
    );

    expect(response.status).toBe(403);
    expect(loadDefaultInterfaceRecord).not.toHaveBeenCalled();
  });

  it('resolves waste permissions without loading an active organization context first', async () => {
    const getSessionById = vi.fn(async () => {
      throw new Error('redis_down');
    });
    const deps = {
      ...createWasteHandlerDeps(['waste-management.settings.manage'], {
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
      }),
      getSessionById,
    };

    const response = await getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      deps
    );

    expect(response.status).toBe(200);
    expect(getSessionById).not.toHaveBeenCalled();
    expect(deps.resolvePermissions).toHaveBeenCalledWith({
      instanceId: actor.user.instanceId,
      keycloakSubject: actor.user.id,
    });
  });

  it('rejects waste-fraction mutation without the dedicated master-data permission', async () => {
    const saveWasteFraction = vi.fn();

    const response = await createWasteManagementFractionInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/fractions', {
        id: 'fraction-new',
        name: 'Papier',
        color: '#123456',
        active: true,
      }),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        saveWasteFraction,
      })
    );

    expect(response.status).toBe(403);
    expect(saveWasteFraction).not.toHaveBeenCalled();
  });

  it('rejects waste-region mutation without the dedicated master-data permission', async () => {
    const saveWasteRegion = vi.fn();

    const response = await createWasteManagementRegionInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/regions', {
        id: 'region-new',
        name: 'Region West',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        saveWasteRegion,
      })
    );

    expect(response.status).toBe(403);
    expect(saveWasteRegion).not.toHaveBeenCalled();
  });

  it('rejects waste-city mutation without the dedicated master-data permission', async () => {
    const saveWasteCity = vi.fn();

    const response = await createWasteManagementCityInternal(
      createWasteMutationRequest('POST', 'https://studio.test/api/v1/waste-management/cities', {
        id: 'city-new',
        name: 'Musterstadt West',
        regionId: 'region-1',
      }),
      actor,
      createWasteHandlerDeps(['waste-management.read'], {
        saveWasteCity,
      })
    );

    expect(response.status).toBe(403);
    expect(saveWasteCity).not.toHaveBeenCalled();
  });

  it('rejects seed job starts without the dedicated high-risk permission', async () => {
    const startPluginOperationJob = vi.fn();

    const response = await startWasteManagementSeedInternal(
      createWasteMutationRequest(
        'POST',
        'https://studio.test/api/v1/waste-management/tools/seed',
        { seedKey: 'baseline' },
        { 'Idempotency-Key': 'idem-1' }
      ),
      actor,
      createWasteHandlerDeps(['waste-management.import.execute'], {
        startPluginOperationJob,
      })
    );

    expect(response.status).toBe(403);
    expect(startPluginOperationJob).not.toHaveBeenCalled();
  });
});
