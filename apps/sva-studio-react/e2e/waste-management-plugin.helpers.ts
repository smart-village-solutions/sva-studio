import type { BrowserContext, Page, Route } from '@playwright/test';
import type {
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/waste-management-contracts';

type WasteSettingsState = {
  provider: 'postgresql' | 'supabase';
  projectUrl?: string;
  schemaName: string;
  enabled: boolean;
  databaseUrlConfigured: boolean;
  serviceRoleKeyConfigured?: boolean;
  visibleStatus: 'ok' | 'error' | 'unknown' | 'not_configured';
  lastCheckedAt?: string;
  customRecurrencePresets?: WasteCustomRecurrencePresetState[];
};

type WasteCustomRecurrencePresetState = {
  id: string;
  name: string;
  description?: string;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
};

type WasteFractionState = {
  id: string;
  name: string;
  color: string;
  containerSize?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WasteTourState = {
  id: string;
  name: string;
  wasteFractionIds: readonly string[];
  recurrence?: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom';
  customRecurrenceId?: string;
  customRecurrenceName?: string;
  customRecurrenceIntervalDays?: number;
  firstDate?: string;
  endDate?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
};

type WasteRegionState = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteCityState = {
  id: string;
  regionId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteStreetState = {
  id: string;
  cityId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type WasteHouseNumberState = {
  id: string;
  streetId: string;
  number: string;
  createdAt: string;
  updatedAt: string;
};

type WasteCollectionLocationState = {
  id: string;
  regionId?: string;
  cityId: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type WasteJobState = {
  id: string;
  jobTypeId: string;
  status: 'pending';
};

type WasteHarness = {
  readonly requests: {
    settingsUpdates: Array<Record<string, unknown>>;
    createdFractions: Array<Record<string, unknown>>;
    createdTours: Array<Record<string, unknown>>;
    tourValidityUpdates: Array<Record<string, unknown>>;
    tourStatusUpdates: Array<Record<string, unknown>>;
    annualTourTransfers: Array<Record<string, unknown>>;
    exportInputs: Array<Record<string, unknown>>;
    startedJobTypes: string[];
  };
};

const createApiItem = <T>(data: T) => JSON.stringify({ data });

export const mockWasteFacade = async (
  page: Page | BrowserContext,
  input: {
    readonly instanceId: string;
    readonly settings: WasteSettingsState;
    readonly fractions: WasteFractionState[];
    readonly tours: WasteTourState[];
    readonly regions?: WasteRegionState[];
    readonly cities?: WasteCityState[];
    readonly streets?: WasteStreetState[];
    readonly houseNumbers?: WasteHouseNumberState[];
    readonly collectionLocations?: WasteCollectionLocationState[];
    readonly allowFractionCreate?: boolean;
  }
): Promise<WasteHarness> => {
  const settingsState: WasteSettingsState = { ...input.settings };
  settingsState.customRecurrencePresets = [...(input.settings.customRecurrencePresets ?? [])];
  const fractionsState = [...input.fractions];
  const toursState = [...input.tours];
  const regionsState = [...(input.regions ?? [])];
  const citiesState = [...(input.cities ?? [])];
  const streetsState = [...(input.streets ?? [])];
  const houseNumbersState = [...(input.houseNumbers ?? [])];
  const collectionLocationsState = [...(input.collectionLocations ?? [])];
  const requests = {
    settingsUpdates: [] as Array<Record<string, unknown>>,
    createdFractions: [] as Array<Record<string, unknown>>,
    createdTours: [] as Array<Record<string, unknown>>,
    tourValidityUpdates: [] as Array<Record<string, unknown>>,
    tourStatusUpdates: [] as Array<Record<string, unknown>>,
    annualTourTransfers: [] as Array<Record<string, unknown>>,
    exportInputs: [] as Array<Record<string, unknown>>,
    startedJobTypes: [] as string[],
  };

  const handlers: Record<string, (route: Route) => Promise<void>> = {
    'GET /api/v1/waste-management/history': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          audit: {
            items: [],
            total: 0,
          },
          technical: {
            items: [],
            total: 0,
          },
        }),
      });
      return;
    },
    'GET /api/v1/waste-management/master-data': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          fractions: fractionsState,
          regions: regionsState,
          cities: citiesState,
          streets: streetsState,
          houseNumbers: houseNumbersState,
          collectionLocations: collectionLocationsState,
          locationTourLinks: [],
        }),
      });
      return;
    },
    'POST /api/v1/waste-management/fractions': async (route) => {
      const request = route.request();
      if (input.allowFractionCreate === false) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'forbidden', message: 'Keine Berechtigung.' }),
        });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.createdFractions.push(body);
      const created: WasteFractionState = {
        id: String(body.id),
        name: String(body.name),
        color: String(body.color),
        containerSize: typeof body.containerSize === 'string' ? body.containerSize : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        active: body.active !== false,
        createdAt: '2026-05-10T12:15:00.000Z',
        updatedAt: '2026-05-10T12:15:00.000Z',
      };
      fractionsState.unshift(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(created),
      });
      return;
    },
    'GET /api/v1/waste-management/tours': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          tours: toursState,
          customRecurrencePresets: settingsState.customRecurrencePresets ?? [],
        }),
      });
      return;
    },
    'POST /api/v1/waste-management/tours/annual-transfer/preview': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as { sourceYear: number };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          sourceYear: body.sourceYear,
          targetYear: body.sourceYear + 1,
          previewFingerprint: `sha256:${'a'.repeat(64)}`,
          tours: [
            {
              sourceTourId: 'tour-weekly',
              name: 'Restmüll Nord',
              classification: 'transferable',
              sourcePeriod: { firstDate: '2026-01-05', endDate: '2026-12-31' },
              targetPeriod: { firstDate: '2027-01-04', endDate: '2027-12-31' },
              firstTargetDate: '2027-01-04',
              recurrence: 'weekly',
              dateExamples: [{ sourceDate: '2026-01-05', targetDate: '2027-01-04' }],
              relationshipCounts: {
                wasteFractions: 1,
                customDates: 0,
                locations: 0,
                pickupDates: 0,
                assignments: 0,
                shifts: 0,
                excluded: 0,
              },
              replacementResourceIds: [],
              replacementTargetYears: {},
              conflicts: [],
            },
          ],
          summary: {
            transferable: 1,
            alreadyEffective: 0,
            blocked: 0,
            selected: 1,
            relationships: 1,
            excluded: 0,
          },
        } satisfies WasteAnnualTourTransferPreview),
      });
      return;
    },
    'POST /api/v1/waste-management/tours/annual-transfer': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.annualTourTransfers.push(body);
      toursState.unshift({
        id: 'tour-weekly-2027',
        name: 'Restmüll Nord',
        wasteFractionIds: ['fraction-1'],
        recurrence: 'weekly',
        firstDate: '2027-01-04',
        endDate: '2027-12-31',
        status: 'draft',
        createdAt: '2026-08-23T12:00:00.000Z',
        updatedAt: '2026-08-23T12:00:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem({
          sourceYear: 2026,
          targetYear: 2027,
          createdTourIds: ['tour-weekly-2027'],
          existingTourIds: [],
          createdCount: 1,
          existingCount: 0,
          classificationCounts: { transferable: 1, alreadyEffective: 0, blocked: 0 },
          listTarget: { tourValidityPeriod: 'next', status: 'draft' },
        } satisfies WasteAnnualTourTransferResult),
      });
      return;
    },
    'PUT /api/v1/waste-management/tours/bulk-validity': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as {
        tourIds?: string[];
        firstDate?: { mode?: string; value?: string };
        endDate?: { mode?: string; value?: string };
      };
      requests.tourValidityUpdates.push(body);
      const selectedTours = toursState.filter((tour) => body.tourIds?.includes(tour.id));
      const applicable = selectedTours.every(
        (tour) =>
          Boolean(tour.customRecurrenceId) ||
          !['custom', 'on-demand'].includes(tour.recurrence ?? '')
      );
      if (
        selectedTours.length !== body.tourIds?.length ||
        !applicable ||
        body.firstDate?.mode === 'clear'
      ) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_request', message: 'Ungültige Tourauswahl.' }),
        });
        return;
      }
      for (const tour of selectedTours) {
        if (body.firstDate?.mode === 'set') tour.firstDate = body.firstDate.value;
        if (body.endDate?.mode === 'set') tour.endDate = body.endDate.value;
        if (body.endDate?.mode === 'clear') tour.endDate = undefined;
        tour.updatedAt = '2026-05-10T12:40:00.000Z';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({ updatedCount: selectedTours.length }),
      });
      return;
    },
    'PUT /api/v1/waste-management/tours/bulk-status': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as {
        tourIds?: string[];
        status?: WasteTourState['status'];
      };
      requests.tourStatusUpdates.push(body);
      const selectedTours = toursState.filter((tour) => body.tourIds?.includes(tour.id));
      if (
        selectedTours.length !== body.tourIds?.length ||
        !body.status ||
        !['draft', 'published', 'archived'].includes(body.status)
      ) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_request', message: 'Ungültige Tourauswahl.' }),
        });
        return;
      }
      for (const tour of selectedTours) {
        tour.status = body.status;
        tour.updatedAt = '2026-05-10T12:45:00.000Z';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({ updatedCount: selectedTours.length }),
      });
      return;
    },
    'GET /api/v1/waste-management/scheduling': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          globalDateShifts: [],
          tourDateShifts: [],
        }),
      });
      return;
    },
    'GET /api/v1/waste-management/settings': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem(settingsState),
      });
      return;
    },
    'PUT /api/v1/waste-management/settings': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.settingsUpdates.push(body);
      settingsState.projectUrl = String(body.projectUrl ?? settingsState.projectUrl);
      settingsState.schemaName = String(body.schemaName ?? settingsState.schemaName);
      settingsState.enabled = body.enabled !== false;
      settingsState.databaseUrlConfigured = true;
      settingsState.serviceRoleKeyConfigured = true;
      settingsState.visibleStatus = 'ok';
      settingsState.lastCheckedAt = '2026-05-10T12:20:00.000Z';
      const nextPresets = Array.isArray(body.customRecurrencePresets)
        ? body.customRecurrencePresets.map((preset) => {
            const currentPreset = (settingsState.customRecurrencePresets ?? []).find(
              (candidate) => candidate.id === String((preset as Record<string, unknown>).id)
            );
            return {
              id: String((preset as Record<string, unknown>).id),
              name: String((preset as Record<string, unknown>).name),
              description:
                typeof (preset as Record<string, unknown>).description === 'string'
                  ? String((preset as Record<string, unknown>).description)
                  : undefined,
              intervalDays: Number((preset as Record<string, unknown>).intervalDays),
              createdAt: currentPreset?.createdAt ?? '2026-05-10T12:20:00.000Z',
              updatedAt: '2026-05-10T12:20:00.000Z',
            } satisfies WasteCustomRecurrencePresetState;
          })
        : (settingsState.customRecurrencePresets ?? []);
      const nextPresetMap = new Map(nextPresets.map((preset) => [preset.id, preset] as const));
      const deletedPresetFallbacks =
        typeof body.deletedPresetFallbacks === 'object' && body.deletedPresetFallbacks
          ? (body.deletedPresetFallbacks as Record<string, { kind?: string; value?: string }>)
          : {};

      for (const tour of toursState) {
        if (!tour.customRecurrenceId) {
          continue;
        }
        const resolvedPreset = nextPresetMap.get(tour.customRecurrenceId);
        if (resolvedPreset) {
          tour.customRecurrenceName = resolvedPreset.name;
          tour.customRecurrenceIntervalDays = resolvedPreset.intervalDays;
          continue;
        }

        const fallback = deletedPresetFallbacks[tour.customRecurrenceId];
        if (!fallback) {
          tour.customRecurrenceId = undefined;
          tour.customRecurrenceName = undefined;
          tour.customRecurrenceIntervalDays = undefined;
          continue;
        }

        if (fallback.kind === 'preset') {
          const fallbackPreset = nextPresetMap.get(String(fallback.value));
          tour.customRecurrenceId = fallbackPreset?.id;
          tour.customRecurrenceName = fallbackPreset?.name;
          tour.customRecurrenceIntervalDays = fallbackPreset?.intervalDays;
          tour.recurrence = undefined;
          continue;
        }

        tour.customRecurrenceId = undefined;
        tour.customRecurrenceName = undefined;
        tour.customRecurrenceIntervalDays = undefined;
        tour.recurrence = String(fallback.value) as WasteTourState['recurrence'];
      }

      settingsState.customRecurrencePresets = nextPresets;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem(settingsState),
      });
      return;
    },
    'POST /api/v1/waste-management/tours': async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.createdTours.push(body);
      const preset =
        typeof body.customRecurrenceId === 'string'
          ? (settingsState.customRecurrencePresets ?? []).find(
              (candidate) => candidate.id === body.customRecurrenceId
            )
          : undefined;
      const created: WasteTourState = {
        id: String(body.id),
        name: String(body.name),
        wasteFractionIds: Array.isArray(body.wasteFractionIds)
          ? body.wasteFractionIds.map(String)
          : [],
        recurrence:
          typeof body.recurrence === 'string'
            ? (body.recurrence as WasteTourState['recurrence'])
            : undefined,
        customRecurrenceId:
          typeof body.customRecurrenceId === 'string' ? body.customRecurrenceId : undefined,
        customRecurrenceName: preset?.name,
        customRecurrenceIntervalDays: preset?.intervalDays,
        firstDate: typeof body.firstDate === 'string' ? body.firstDate : undefined,
        endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
        status: 'draft',
        createdAt: '2026-05-10T12:30:00.000Z',
        updatedAt: '2026-05-10T12:30:00.000Z',
      };
      toursState.unshift(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(created),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/imports/upload': async (route) => {
      const request = route.request();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem({
          blobRef: 'plugin-operation-input:00000000-0000-4000-8000-000000000001',
          sizeBytes: request.postDataBuffer()?.byteLength ?? 0,
        }),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/imports/preview': async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: createApiItem({
          profileId: 'waste-management.ortsbezogene-tourtermine',
          delimiter: ';',
          detectedDelimiter: ';',
          fractionNames: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
          existingFractions: ['Restmüll'],
          newFractions: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
          existingTours: [],
          newTours: ['HM.3.3', 'PPK.7.2', 'LVP.9.4'],
          validRowCount: 1,
          invalidRowCount: 0,
          errors: [],
          summary: {
            fractions: { existing: 0, created: 3 },
            regions: { existing: 0, created: 0 },
            cities: { existing: 0, created: 1 },
            streets: { existing: 0, created: 1 },
            houseNumbers: { existing: 0, created: 1 },
            locations: { existing: 0, created: 1 },
            assignments: { existing: 0, created: 3 },
          },
        }),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/imports': async (route) => {
      requests.startedJobTypes.push('waste-management.import-data');
      const job: WasteJobState = {
        id: 'job-import-1',
        jobTypeId: 'waste-management.import-data',
        status: 'pending',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(job),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/exports': async (route) => {
      const request = route.request();
      requests.exportInputs.push(request.postDataJSON() as Record<string, unknown>);
      requests.startedJobTypes.push('waste-management.export-data');
      const job: WasteJobState = {
        id: 'job-export-1',
        jobTypeId: 'waste-management.export-data',
        status: 'pending',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(job),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/migrations': async (route) => {
      requests.startedJobTypes.push('waste-management.apply-migrations');
      const job: WasteJobState = {
        id: 'job-migrate-1',
        jobTypeId: 'waste-management.apply-migrations',
        status: 'pending',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(job),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/seed': async (route) => {
      requests.startedJobTypes.push('waste-management.seed-data');
      const job: WasteJobState = {
        id: 'job-seed-1',
        jobTypeId: 'waste-management.seed-data',
        status: 'pending',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(job),
      });
      return;
    },
    'POST /api/v1/waste-management/tools/reset': async (route) => {
      requests.startedJobTypes.push('waste-management.reset-data');
      const job: WasteJobState = {
        id: 'job-reset-1',
        jobTypeId: 'waste-management.reset-data',
        status: 'pending',
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: createApiItem(job),
      });
      return;
    },
  };

  await page.route('**/api/v1/waste-management/**', async (route: Route) => {
    const request = route.request();
    const handler = handlers[`${request.method()} ${new URL(request.url()).pathname}`];
    if (handler) {
      await handler(route);
      return;
    }
    await route.fallback();
  });

  return { requests };
};
