import type {
  StudioJobDetail,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteManagementSettingsRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementGlobalDateShiftInput,
  CreateWasteManagementTourDateShiftInput,
  CreateWasteManagementTourInput,
  PreviewWasteLocationTourPickupDateImportInput,
  PreviewWasteLocationTourPickupDateImportResult,
  StartWasteManagementImportInput,
  StartWasteManagementMainserverSyncInput,
  StartWasteManagementMigrationsInput,
  StartWasteManagementResetInput,
  StartWasteManagementSeedInput,
  UpdateWasteManagementGlobalDateShiftInput,
  UpdateWasteManagementHolidayRuleInput,
  UpdateWasteManagementTourDateShiftInput,
  UpdateWasteManagementTourInput,
  WasteManagementSettingsInput,
} from './waste-management.api.types.js';
import {
  requestWasteManagementJob,
  requestWasteManagementJobDetail,
  requestWasteManagementMutation,
} from './waste-management.api.shared.js';

export const createWasteManagementTour = async (input: CreateWasteManagementTourInput): Promise<WasteTourRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours', input);

export const updateWasteManagementTour = async (
  tourId: string,
  input: UpdateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`, input, 'PUT');

export const deleteWasteManagementTour = async (tourId: string): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(`/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`, undefined, 'DELETE');

export const createWasteManagementTourDateShift = async (
  input: CreateWasteManagementTourDateShiftInput
): Promise<WasteTourDateShiftRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/tour-date-shifts', input);

export const updateWasteManagementTourDateShift = async (
  shiftId: string,
  input: UpdateWasteManagementTourDateShiftInput
): Promise<WasteTourDateShiftRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/tour-date-shifts/${encodeURIComponent(shiftId)}`,
    input,
    'PUT'
  );

export const deleteWasteManagementTourDateShift = async (shiftId: string): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(`/api/v1/waste-management/tour-date-shifts/${encodeURIComponent(shiftId)}`, undefined, 'DELETE');

export const createWasteManagementGlobalDateShift = async (
  input: CreateWasteManagementGlobalDateShiftInput
): Promise<WasteGlobalDateShiftRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/global-date-shifts', input);

export const updateWasteManagementGlobalDateShift = async (
  shiftId: string,
  input: UpdateWasteManagementGlobalDateShiftInput
): Promise<WasteGlobalDateShiftRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/global-date-shifts/${encodeURIComponent(shiftId)}`,
    input,
    'PUT'
  );

export const deleteWasteManagementGlobalDateShift = async (shiftId: string): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(`/api/v1/waste-management/global-date-shifts/${encodeURIComponent(shiftId)}`, undefined, 'DELETE');

export const updateWasteManagementSettings = async (
  input: WasteManagementSettingsInput
): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementMutation('/api/v1/waste-management/settings', input, 'PUT');

export const startWasteManagementHolidaySync = async (): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementMutation('/api/v1/waste-management/settings/holiday-sync', {}, 'POST');

export const updateWasteManagementHolidayRule = async (
  ruleId: string,
  input: UpdateWasteManagementHolidayRuleInput
): Promise<WasteHolidayRuleRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/holiday-rules/${encodeURIComponent(ruleId)}`, input, 'PUT');

export const startWasteManagementInitialize = async (input: Readonly<{ targetSchema?: string }> = {}) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/initialize', input);

export const startWasteManagementMigrations = async (input: StartWasteManagementMigrationsInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/migrations', input);

export const startWasteManagementImport = async (input: StartWasteManagementImportInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/imports', input);

export const previewWasteLocationTourPickupDateImport = async (
  input: PreviewWasteLocationTourPickupDateImportInput
): Promise<PreviewWasteLocationTourPickupDateImportResult> =>
  requestWasteManagementMutation('/api/v1/waste-management/tools/imports/preview', input);

export const startWasteManagementSeed = async (input: StartWasteManagementSeedInput = {}) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/seed', {
    seedKey: input.seedKey ?? 'baseline',
  });

export const startWasteManagementMainserverSync = async (input: StartWasteManagementMainserverSyncInput = {}) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/mainserver-sync', input);

export const startWasteManagementSyncWasteTypes = async () =>
  requestWasteManagementJob('/api/v1/waste-management/tools/sync-waste-types', {});

export const startWasteManagementReset = async (input: StartWasteManagementResetInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/reset', input);

export const deleteWasteManagementHistoryJob = async (jobId: string): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(`/api/v1/plugin-operations/jobs/${encodeURIComponent(jobId)}`, undefined, 'DELETE');

export const getWasteManagementJobDetail = async (
  jobId: string,
  init?: RequestInit
): Promise<StudioJobDetail> => requestWasteManagementJobDetail(jobId, init);
