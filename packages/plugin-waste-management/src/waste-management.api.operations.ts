import type {
  WasteGlobalDateShiftRecord,
  WasteManagementSettingsRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';

import type {
  CreateWasteManagementGlobalDateShiftInput,
  CreateWasteManagementTourDateShiftInput,
  CreateWasteManagementTourInput,
  StartWasteManagementImportInput,
  StartWasteManagementMigrationsInput,
  StartWasteManagementResetInput,
  StartWasteManagementSeedInput,
  UpdateWasteManagementGlobalDateShiftInput,
  UpdateWasteManagementTourDateShiftInput,
  UpdateWasteManagementTourInput,
  WasteManagementSettingsInput,
} from './waste-management.api.types.js';
import { requestWasteManagementJob, requestWasteManagementMutation } from './waste-management.api.shared.js';

export const createWasteManagementTour = async (input: CreateWasteManagementTourInput): Promise<WasteTourRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours', input);

export const updateWasteManagementTour = async (
  tourId: string,
  input: UpdateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`, input, 'PUT');

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

export const updateWasteManagementSettings = async (
  input: WasteManagementSettingsInput
): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementMutation('/api/v1/waste-management/settings', input, 'PUT');

export const startWasteManagementMigrations = async (input: StartWasteManagementMigrationsInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/migrations', input);

export const startWasteManagementImport = async (input: StartWasteManagementImportInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/imports', input);

export const startWasteManagementSeed = async (input: StartWasteManagementSeedInput = {}) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/seed', {
    seedKey: input.seedKey ?? 'baseline',
  });

export const startWasteManagementReset = async (input: StartWasteManagementResetInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/reset', input);
