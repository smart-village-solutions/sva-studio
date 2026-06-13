import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExternalInterfaceConnectionCheckRecord,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementSettingsRecord,
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
} from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.js';

const sessionStore = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({
    id: 'session-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      instanceId: 'tenant-a',
      roles: ['system_admin'],
    },
    createdAt: Date.parse('2026-05-09T12:00:00.000Z'),
    expiresAt: Date.parse('2026-05-09T13:00:00.000Z'),
  })),
}));

vi.mock('../redis-session.js', () => ({
  getSession: sessionStore.getSession,
}));

import { wasteManagementCoreHandlers } from './core.js';

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

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const baseInterfaceRecord = {
  id: 'supabase-1',
  instanceId: 'tenant-a',
  typeKey: 'supabase' as const,
  ownerKind: 'host' as const,
  ownerId: 'host',
  displayName: 'Waste Supabase',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database' as const,
  statusCheckKind: 'supabase' as const,
  visibleStatus: 'unknown' as const,
  publicConfig: {
    projectUrl: 'https://tenant-a.supabase.co',
    schemaName: 'public',
    holidayStateCode: 'NW',
    lastHolidaySyncStatus: 'success',
  },
  secretConfigCiphertext: 'cipher-secret',
};

const resolvedActorInfo = {
  actor: {
    instanceId: 'tenant-a',
    actorAccountId: 'account-1',
    requestId: 'req-test',
    traceId: 'trace-test',
  },
};

const allowPermission = (action: string) => [
  {
    action,
    resourceType: 'waste-management',
    effect: 'allow' as const,
  },
];

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
      {
        getRequestId: () => 'req-test',
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        instanceId: 'tenant-a',
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'public',
        enabled: true,
        selectedInterfaceId: 'supabase-1',
        selectedInterfaceName: 'Waste Supabase',
        selectedInterfaceTypeKey: 'supabase',
        availableInterfaces: [
          {
            id: 'supabase-1',
            name: 'Waste Supabase',
            typeKey: 'supabase',
            enabled: true,
            visibleStatus: 'unknown',
            isSelected: true,
          },
        ],
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        visibleStatus: 'unknown',
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
      {
        getRequestId: () => 'req-test',
        loadMasterDataOverview: vi.fn(async () => overview),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: overview,
      requestId: 'req-test',
    });
  });

  it('returns the combined waste audit and technical history for the authenticated instance', async () => {

    const response = await getWasteManagementHistoryInternal(
      new Request('https://studio.test/api/v1/waste-management/history?page=2&pageSize=10&q=fraction'),
      actor,
      {
        getRequestId: () => 'req-test',
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
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
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
      {
        getRequestId: () => 'req-test',
        loadMasterDataOverview: vi.fn(async () => overview),
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        saveExternalInterfaceConnectionCheck,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
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
          active: true,
          locationCount: 12,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
    };

    const response = await getWasteManagementToursOverviewInternal(
      new Request('https://studio.test/api/v1/waste-management/tours'),
      actor,
      {
        getRequestId: () => 'req-test',
        loadToursOverview: vi.fn(async () => overview),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
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
      {
        getRequestId: () => 'req-test',
        loadSchedulingOverview: vi.fn(async () => overview),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: overview,
      requestId: 'req-test',
    });
  });

  it('saves custom recurrence presets through the settings mutation path', async () => {

    const saveExternalInterfaceConnectionCheck = vi.fn(async (_record: ExternalInterfaceConnectionCheckRecord) => undefined);

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
      new Request('https://studio.test/api/v1/waste-management/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
          enabled: true,
          holidayStateCode: 'NW',
          customRecurrencePresets: [{ id: 'preset-10', name: '10 Tage', intervalDays: 10 }],
          deletedPresetFallbacks: {},
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveExternalInterfaceConnectionCheck,
        saveExternalInterfaceRecord,
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        loadWasteCustomRecurrencePresets,
        saveWasteCustomRecurrencePresets,
        syncWasteHolidayRules,
        emitAuditEvent,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/settings/holiday-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveExternalInterfaceRecord,
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        loadWasteCustomRecurrencePresets: vi.fn(async () => []),
        syncWasteHolidayRules,
        emitAuditEvent: vi.fn(async () => undefined),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
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
    const loadMasterDataFractionsOverview = vi.fn(async (): Promise<WasteManagementMasterDataOverview> => ({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-fraction-create' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await createWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
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
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        emitAuditEvent,
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
        startPluginOperationJob,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
    const loadMasterDataFractionsOverview = vi.fn(async (): Promise<WasteManagementMasterDataOverview> => ({
      fractions: [],
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      collectionLocations: [],
      locationTourLinks: [],
    }));
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-fraction-update' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const response = await updateWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions/fraction-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
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
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        loadMasterDataFractionsOverview,
        saveWasteFraction,
        loadWasteFractionById,
        startPluginOperationJob,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/regions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'region-new',
          name: 'Region West',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteRegion,
        loadWasteRegionById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/regions/region-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Region Mitte Plus',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteRegion,
        loadWasteRegionById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'city-new',
          name: 'Musterstadt West',
          regionId: 'region-1',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteCity,
        loadWasteCityById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      .mockResolvedValueOnce(updatedCity);
    const saveWasteCity = vi.fn(async () => undefined);

    const response = await updateWasteManagementCityInternal(
      new Request('https://studio.test/api/v1/waste-management/cities/city-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Musterstadt Nord',
          regionId: 'region-1',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteCity,
        loadWasteCityById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
    );

    expect(saveWasteCity).toHaveBeenCalledWith('tenant-a', {
      id: 'city-1',
      name: 'Musterstadt Nord',
      regionId: 'region-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: updatedCity,
      requestId: 'req-test',
    });
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
      new Request('https://studio.test/api/v1/waste-management/streets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'street-new',
          name: 'Parkweg',
          cityId: 'city-1',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteStreet,
        loadWasteStreetById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      cityId: 'city-2',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteStreetById = vi
      .fn<(_: string, __: string) => Promise<WasteStreetRecord | null>>()
      .mockResolvedValueOnce(existingStreet)
      .mockResolvedValueOnce(updatedStreet);
    const saveWasteStreet = vi.fn(async () => undefined);

    const response = await updateWasteManagementStreetInternal(
      new Request('https://studio.test/api/v1/waste-management/streets/street-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Parkweg Nord',
          cityId: 'city-2',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteStreet,
        loadWasteStreetById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
    );

    expect(saveWasteStreet).toHaveBeenCalledWith('tenant-a', {
      id: 'street-1',
      name: 'Parkweg Nord',
      cityId: 'city-2',
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
      new Request('https://studio.test/api/v1/waste-management/house-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'house-new',
          number: '14',
          streetId: 'street-1',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      streetId: 'street-2',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const loadWasteHouseNumberById = vi
      .fn<(_: string, __: string) => Promise<WasteHouseNumberRecord | null>>()
      .mockResolvedValueOnce(existingHouseNumber)
      .mockResolvedValueOnce(updatedHouseNumber);
    const saveWasteHouseNumber = vi.fn(async () => undefined);

    const response = await updateWasteManagementHouseNumberInternal(
      new Request('https://studio.test/api/v1/waste-management/house-numbers/house-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          number: '14a',
          streetId: 'street-2',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteHouseNumber,
        loadWasteHouseNumberById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
    );

    expect(saveWasteHouseNumber).toHaveBeenCalledWith('tenant-a', {
      id: 'house-1',
      number: '14a',
      streetId: 'street-2',
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
      new Request('https://studio.test/api/v1/waste-management/collection-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'location-new',
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/collection-locations/location-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          cityId: 'city-1',
          regionId: 'region-1',
          streetId: 'street-1',
          houseNumberId: 'house-2',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteCollectionLocation,
        loadWasteCollectionLocationById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.master-data.manage'),
        })),
      }
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
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteLocationTourLink = vi.fn(async () => undefined);
    const loadWasteLocationTourLinkById = vi.fn(async () => savedLink);

    const response = await createWasteManagementLocationTourLinkInternal(
      new Request('https://studio.test/api/v1/waste-management/location-tour-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'link-new',
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          endDate: '2026-12-31',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
    );

    expect(saveWasteLocationTourLink).toHaveBeenCalledWith('tenant-a', {
      id: 'link-new',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
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
      new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          locationId: 'location-1',
          tourId: 'tour-1',
          startDate: '2026-05-01',
          endDate: '2026-12-31',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        emitAuditEvent,
        saveWasteLocationTourLink,
        loadWasteLocationTourLinkById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
    );

    expect(saveWasteLocationTourLink).toHaveBeenCalledWith('tenant-a', {
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
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
      new Request('https://studio.test/api/v1/waste-management/location-tour-links/link-1', {
        method: 'DELETE',
        headers: {
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        emitAuditEvent,
        deleteWasteLocationTourLink,
        loadWasteLocationTourLinkById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
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
      active: true,
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    };

    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => savedTour);

    const response = await createWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'tour-new',
          name: 'Papier Mitte',
          description: 'Zweiwöchentliche Tour',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'biweekly',
          firstDate: '2026-05-19',
          customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        loadWasteTourById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
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
      active: true,
      locationCount: undefined,
    });
    expect(loadWasteTourById).toHaveBeenCalledWith('tenant-a', 'tour-new');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: savedTour,
      requestId: 'req-test',
    });
  });

  it('duplicates tour links and date shifts after creating a duplicated waste tour', async () => {
    const savedTour: WasteTourRecord = {
      id: 'tour-copy-1',
      name: 'Papier Mitte (Kopie)',
      description: 'Zweiwöchentliche Tour',
      wasteFractionIds: ['fraction-2'],
      recurrence: 'biweekly',
      firstDate: '2026-05-19',
      customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
      active: true,
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

    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => savedTour);
    const listWasteLocationTourLinksByTourId = vi.fn(async () => sourceLinks);
    const saveWasteLocationTourLink = vi.fn(async () => undefined);
    const listWasteTourDateShiftsByTourId = vi.fn(async () => sourceShifts);
    const saveWasteTourDateShift = vi.fn(async () => undefined);
    const deleteWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'tour-copy-1',
          name: 'Papier Mitte (Kopie)',
          description: 'Zweiwöchentliche Tour',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'biweekly',
          firstDate: '2026-05-19',
          customDates: [{ date: '2026-06-02', description: 'Sonderabfuhr' }],
          duplicateFromTourId: 'tour-source-1',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        loadWasteTourById,
        listWasteLocationTourLinksByTourId,
        saveWasteLocationTourLink,
        listWasteTourDateShiftsByTourId,
        saveWasteTourDateShift,
        deleteWasteTour,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            ...allowPermission('waste-management.tours.manage'),
            ...allowPermission('waste-management.scheduling.manage'),
          ],
        })),
      }
    );

    expect(listWasteLocationTourLinksByTourId).toHaveBeenCalledWith('tenant-a', 'tour-source-1');
    expect(saveWasteLocationTourLink).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-copy-1',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
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
    expect(response.status).toBe(201);
  });

  it('rejects duplicated waste tour creation without scheduling permission', async () => {
    const saveWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'tour-copy-2',
          name: 'Papier Mitte (Kopie)',
          wasteFractionIds: ['fraction-2'],
          duplicateFromTourId: 'tour-source-1',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(saveWasteTour).not.toHaveBeenCalled();
  });

  it('rolls back the created waste tour when duplicated relation copying fails', async () => {
    const saveWasteTour = vi.fn(async () => undefined);
    const loadWasteTourById = vi.fn(async () => null);
    const listWasteLocationTourLinksByTourId = vi.fn(async () => [
      {
        id: 'link-source-1',
        locationId: 'location-1',
        tourId: 'tour-source-1',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ] satisfies readonly WasteLocationTourLinkRecord[]);
    const saveWasteLocationTourLink = vi.fn(async () => {
      throw new Error('copy_failed');
    });
    const listWasteTourDateShiftsByTourId = vi.fn(async () => []);
    const deleteWasteTour = vi.fn(async () => undefined);

    const response = await createWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'tour-copy-3',
          name: 'Papier Mitte (Kopie)',
          wasteFractionIds: ['fraction-2'],
          duplicateFromTourId: 'tour-source-1',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        loadWasteTourById,
        listWasteLocationTourLinksByTourId,
        saveWasteLocationTourLink,
        listWasteTourDateShiftsByTourId,
        deleteWasteTour,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            ...allowPermission('waste-management.tours.manage'),
            ...allowPermission('waste-management.scheduling.manage'),
          ],
        })),
      }
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
      active: true,
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
      new Request('https://studio.test/api/v1/waste-management/tours/tour-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          name: 'Restmüll Nord Plus',
          description: 'Angepasste Route',
          wasteFractionIds: ['fraction-1'],
          recurrence: 'weekly',
          firstDate: '2026-05-12',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        loadWasteTourById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
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
      active: true,
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
      active: true,
      createdAt: '2026-05-09T12:00:00.000Z',
      updatedAt: '2026-05-09T12:30:00.000Z',
    }));

    const response = await createWasteManagementTourInternal(
      new Request('https://studio.test/api/v1/waste-management/tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'tour-custom',
          name: 'Papier Intervall',
          wasteFractionIds: ['fraction-2'],
          recurrence: 'weekly',
          customRecurrenceId: 'preset-10',
          firstDate: '2026-05-19',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTour,
        loadWasteTourById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
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
      active: true,
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

    const saveWasteTourDateShift = vi.fn(async () => undefined);
    const loadWasteTourDateShiftById = vi.fn(async () => savedShift);

    const response = await createWasteManagementTourDateShiftInternal(
      new Request('https://studio.test/api/v1/waste-management/tour-date-shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'shift-new',
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-23',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'propagate-series',
          description: 'Vorverlegt',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.scheduling.manage'),
        })),
      }
    );

    expect(saveWasteTourDateShift).toHaveBeenCalledWith('tenant-a', {
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
      new Request('https://studio.test/api/v1/waste-management/tour-date-shifts/shift-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          tourId: 'tour-1',
          originalDate: '2026-12-24',
          actualDate: '2026-12-22',
          hasYear: true,
          reasonType: 'manual-adjustment',
          reasonKey: 'xmas-pull-forward',
          followUpMode: 'mark-follow-up-dates',
          description: 'Stärker vorverlegt',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteTourDateShift,
        loadWasteTourDateShiftById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.scheduling.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/global-date-shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'global-shift-new',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'new-year',
          description: 'Neujahr',
          tourIds: ['tour-1'],
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.scheduling.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/global-date-shifts/global-shift-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          originalDate: '2026-01-01',
          actualDate: '2026-01-03',
          hasYear: true,
          reasonType: 'global-deviation',
          reasonKey: 'holiday-backlog',
          tourIds: ['tour-1', 'tour-2'],
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteGlobalDateShift,
        loadWasteGlobalDateShiftById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.scheduling.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/holiday-rules/holiday-rule-1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          scope: 'holiday-only',
          strategy: 'advance',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteHolidayRule,
        loadWasteHolidayRuleById,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.scheduling.manage'),
        })),
      }
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
          active: true,
        },
      },
      {
        label: 'tour-date-shift',
        handler: createWasteManagementTourDateShiftInternal,
        url: 'https://studio.test/api/v1/waste-management/tour-date-shifts',
        permission: 'waste-management.scheduling.manage',
        deps: {
          saveWasteTourDateShift: vi.fn(async () => undefined),
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
        new Request(testCase.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://studio.test',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(testCase.body),
        }),
        actor,
        {
          getRequestId: () => `req-${testCase.label}`,
          resolvePermissions: vi.fn(async () => ({
            ok: true as const,
            permissions: allowPermission(testCase.permission),
          })),
          ...testCase.deps,
        }
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
          loadWasteStreetById: vi.fn(async () => ({ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' })),
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
          loadWasteHouseNumberById: vi.fn(async () => ({ id: 'house-1', number: '12', streetId: 'street-1' })),
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
            active: true,
            locationCount: 2,
          })),
        },
        body: {
          name: 'Restmüll Nord Plus',
          wasteFractionIds: ['fraction-1'],
          active: true,
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
        new Request(testCase.url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://studio.test',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(testCase.body),
        }),
        actor,
        {
          getRequestId: () => `req-${testCase.label}`,
          resolvePermissions: vi.fn(async () => ({
            ok: true as const,
            permissions: allowPermission(testCase.permission),
          })),
          ...testCase.deps,
        }
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

    const startJob = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'job-1' } }), { status: 202 }));

    const response = await startWasteManagementMigrationsInternal(
      new Request('https://studio.test/api/v1/waste-management/tools/migrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          targetSchema: 'wm',
          requestedByVersion: '2026.05.0',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
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
    const startJob = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'job-init-1' } }), { status: 202 }));

    const response = await startWasteManagementInitializeInternal(
      new Request('https://studio.test/api/v1/waste-management/tools/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-0',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          targetSchema: 'wm',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/tools/migrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-2',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          targetSchema: 'other_schema',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          ...baseInterfaceRecord,
          publicConfig: {
            ...baseInterfaceRecord.publicConfig,
            schemaName: 'wm',
          },
        })),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.settings.manage'),
        })),
      }
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
      new Request('https://studio.test/api/v1/waste-management/location-tour-links/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          locationIds: ['location-1', 'location-2'],
          tourId: 'tour-1',
          startDate: '2026-05-01',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteLocationTourLinksBulk,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.tours.manage'),
        })),
      }
    );

    expect(saveWasteLocationTourLinksBulk).toHaveBeenCalledWith('tenant-a', {
      locationIds: ['location-1', 'location-2'],
      tourId: 'tour-1',
      startDate: '2026-05-01',
      endDate: undefined,
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
    const startJob = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'job-import-1' } }), { status: 202 }));

    const response = await startWasteManagementImportInternal(
      new Request('https://studio.test/api/v1/waste-management/tools/imports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          importProfileId: 'waste-management.geografie-abholorte',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blobRef: 'blob:waste/imports/catalog.csv',
          dryRun: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob: startJob,
        resolveActorInfo: vi.fn(async () => resolvedActorInfo),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.import.execute'),
        })),
      }
    );

    expect(startJob).toHaveBeenCalledWith({
      actorAccountId: 'account-1',
      data: {
        input: {
          operation: 'import-data',
          importProfileId: 'waste-management.geografie-abholorte',
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dryRun: true,
          blobRef: 'blob:waste/imports/catalog.csv',
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
      new Request('https://studio.test/api/v1/waste-management/tools/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob: vi.fn(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.reset.execute'),
        })),
      }
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
      {
        getRequestId: () => 'req-test',
        loadDefaultInterfaceRecord,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(loadDefaultInterfaceRecord).not.toHaveBeenCalled();
  });

  it('resolves waste permissions without loading an active organization context first', async () => {
    const resolvePermissions = vi.fn(async () => ({
      ok: true as const,
      permissions: allowPermission('waste-management.settings.manage'),
    }));
    const getSessionById = vi.fn(async () => {
      throw new Error('redis_down');
    });

    const response = await getWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings'),
      actor,
      {
        getRequestId: () => 'req-test',
        getSessionById,
        loadDefaultInterfaceRecord: vi.fn(async () => baseInterfaceRecord),
        resolvePermissions,
      }
    );

    expect(response.status).toBe(200);
    expect(getSessionById).not.toHaveBeenCalled();
    expect(resolvePermissions).toHaveBeenCalledWith({
      instanceId: actor.user.instanceId,
      keycloakSubject: actor.user.id,
    });
  });

  it('rejects waste-fraction mutation without the dedicated master-data permission', async () => {

    const saveWasteFraction = vi.fn();

    const response = await createWasteManagementFractionInternal(
      new Request('https://studio.test/api/v1/waste-management/fractions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'fraction-new',
          name: 'Papier',
          color: '#123456',
          active: true,
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteFraction,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(saveWasteFraction).not.toHaveBeenCalled();
  });

  it('rejects waste-region mutation without the dedicated master-data permission', async () => {

    const saveWasteRegion = vi.fn();

    const response = await createWasteManagementRegionInternal(
      new Request('https://studio.test/api/v1/waste-management/regions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'region-new',
          name: 'Region West',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteRegion,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(saveWasteRegion).not.toHaveBeenCalled();
  });

  it('rejects waste-city mutation without the dedicated master-data permission', async () => {

    const saveWasteCity = vi.fn();

    const response = await createWasteManagementCityInternal(
      new Request('https://studio.test/api/v1/waste-management/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          id: 'city-new',
          name: 'Musterstadt West',
          regionId: 'region-1',
        }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        saveWasteCity,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.read'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(saveWasteCity).not.toHaveBeenCalled();
  });

  it('rejects seed job starts without the dedicated high-risk permission', async () => {

    const startPluginOperationJob = vi.fn();

    const response = await startWasteManagementSeedInternal(
      new Request('https://studio.test/api/v1/waste-management/tools/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-1',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ seedKey: 'baseline' }),
      }),
      actor,
      {
        getRequestId: () => 'req-test',
        startPluginOperationJob,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: allowPermission('waste-management.import.execute'),
        })),
      }
    );

    expect(response.status).toBe(403);
    expect(startPluginOperationJob).not.toHaveBeenCalled();
  });
});
