import type { BrowserContext, Page, Route } from '@playwright/test';
import {
  getHistory,
  getMasterData,
  createFraction,
  getScheduling,
} from './waste-management-plugin.master-data';
import {
  getTours,
  createTour,
  updateTourValidity,
  updateTourStatus,
} from './waste-management-plugin.tours';
import {
  previewAnnualTransfer,
  transferAnnualTours,
} from './waste-management-plugin.annual-transfer';
import { getSettings, updateSettings } from './waste-management-plugin.settings';
import {
  uploadImport,
  previewImport,
  startImport,
  startExport,
  startMigration,
  startSeed,
  startReset,
} from './waste-management-plugin.tools';

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

export type WasteCustomRecurrencePresetState = {
  id: string;
  name: string;
  description?: string;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
};

export type WasteFractionState = {
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

export type WasteJobState = {
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

type WasteFacadeInput = {
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
};

export type WasteFacadeState = {
  readonly input: WasteFacadeInput;
  readonly settingsState: WasteSettingsState;
  readonly fractionsState: WasteFractionState[];
  readonly toursState: WasteTourState[];
  readonly regionsState: WasteRegionState[];
  readonly citiesState: WasteCityState[];
  readonly streetsState: WasteStreetState[];
  readonly houseNumbersState: WasteHouseNumberState[];
  readonly collectionLocationsState: WasteCollectionLocationState[];
  readonly requests: WasteHarness['requests'];
};

export const mockWasteFacade = async (
  page: Page | BrowserContext,
  input: WasteFacadeInput
): Promise<WasteHarness> => {
  const state: WasteFacadeState = {
    input,
    settingsState: {
      ...input.settings,
      customRecurrencePresets: [...(input.settings.customRecurrencePresets ?? [])],
    },
    fractionsState: [...input.fractions],
    toursState: [...input.tours],
    regionsState: [...(input.regions ?? [])],
    citiesState: [...(input.cities ?? [])],
    streetsState: [...(input.streets ?? [])],
    houseNumbersState: [...(input.houseNumbers ?? [])],
    collectionLocationsState: [...(input.collectionLocations ?? [])],
    requests: {
      settingsUpdates: [],
      createdFractions: [],
      createdTours: [],
      tourValidityUpdates: [],
      tourStatusUpdates: [],
      annualTourTransfers: [],
      exportInputs: [],
      startedJobTypes: [],
    },
  };
  const handlers: Record<string, (route: Route) => Promise<void>> = {
    'GET /api/v1/waste-management/history': (route) => getHistory(route),
    'GET /api/v1/waste-management/master-data': (route) => getMasterData(route, state),
    'POST /api/v1/waste-management/fractions': (route) => createFraction(route, state),
    'GET /api/v1/waste-management/scheduling': (route) => getScheduling(route),
    'GET /api/v1/waste-management/tours': (route) => getTours(route, state),
    'POST /api/v1/waste-management/tours': (route) => createTour(route, state),
    'PUT /api/v1/waste-management/tours/bulk-validity': (route) => updateTourValidity(route, state),
    'PUT /api/v1/waste-management/tours/bulk-status': (route) => updateTourStatus(route, state),
    'POST /api/v1/waste-management/tours/annual-transfer/preview': (route) =>
      previewAnnualTransfer(route),
    'POST /api/v1/waste-management/tours/annual-transfer': (route) =>
      transferAnnualTours(route, state),
    'GET /api/v1/waste-management/settings': (route) => getSettings(route, state),
    'PUT /api/v1/waste-management/settings': (route) => updateSettings(route, state),
    'POST /api/v1/waste-management/tools/imports/upload': (route) => uploadImport(route),
    'POST /api/v1/waste-management/tools/imports/preview': (route) => previewImport(route),
    'POST /api/v1/waste-management/tools/imports': (route) => startImport(route, state),
    'POST /api/v1/waste-management/tools/exports': (route) => startExport(route, state),
    'POST /api/v1/waste-management/tools/migrations': (route) => startMigration(route, state),
    'POST /api/v1/waste-management/tools/seed': (route) => startSeed(route, state),
    'POST /api/v1/waste-management/tools/reset': (route) => startReset(route, state),
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

  return { requests: state.requests };
};
