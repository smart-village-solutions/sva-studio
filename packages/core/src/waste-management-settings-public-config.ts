import type { ExternalInterfaceRecord } from './external-interfaces-contract.js';
import type { WasteHolidayStateCode } from './waste-management/master-data-contract.js';
import { wasteManagementMasterDataContract } from './waste-management-master-data.js';
import { wasteManagementDataSourceContract, type WasteHolidaySyncStatus } from './waste-management-contract.js';

const WASTE_SELECTED_INTERFACE_KEY = 'wasteManagementSelected';
const WASTE_CALENDAR_WEB_URL_KEY = 'calendarWebUrl';
const WASTE_PDF_BRANDING_ASSET_URL_KEY = 'pdfBrandingAssetUrl';
const WASTE_PDF_CONTACT_BLOCK_KEY = 'pdfContactBlock';
const WASTE_HOLIDAY_STATE_CODE_KEY = 'holidayStateCode';
const WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY = 'lastHolidaySyncStatus';
const WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY = 'lastSuccessfulHolidaySyncAt';

const readTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const isWasteManagementInterfaceSelected = (
  record: Pick<ExternalInterfaceRecord, 'publicConfig'>
): boolean => record.publicConfig[WASTE_SELECTED_INTERFACE_KEY] === true;

export const findSelectedWasteManagementInterfaceRecord = (
  records: readonly ExternalInterfaceRecord[]
): ExternalInterfaceRecord | null =>
  records.find(isWasteManagementInterfaceSelected) ??
  records.find((record) => record.typeKey === 'supabase' && record.isDefault) ??
  records.find((record) => record.typeKey === 'supabase') ??
  null;

export const readWasteManagementCalendarWebUrl = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_CALENDAR_WEB_URL_KEY]);

export const readWasteManagementPdfBrandingAssetUrl = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY]);

export const readWasteManagementPdfContactBlock = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_PDF_CONTACT_BLOCK_KEY]);

export const readWasteManagementHolidayStateCode = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteHolidayStateCode | undefined => {
  const value = publicConfig[WASTE_HOLIDAY_STATE_CODE_KEY];
  return typeof value === 'string' && wasteManagementMasterDataContract.isWasteHolidayStateCode(value) ? value : undefined;
};

export const readWasteManagementHolidaySyncStatus = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteHolidaySyncStatus | undefined => {
  const value = publicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY];
  return typeof value === 'string' && wasteManagementDataSourceContract.isHolidaySyncStatus(value) ? value : undefined;
};

export const readWasteManagementLastSuccessfulHolidaySyncAt = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY]);

export const buildWasteManagementPublicConfig = (
  currentPublicConfig: Readonly<Record<string, unknown>>,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
    readonly lastSuccessfulHolidaySyncAt?: string;
  }
): Record<string, unknown> => {
  const nextPublicConfig: Record<string, unknown> = { ...currentPublicConfig };

  if (input.selected) {
    nextPublicConfig[WASTE_SELECTED_INTERFACE_KEY] = true;
  } else {
    delete nextPublicConfig[WASTE_SELECTED_INTERFACE_KEY];
  }

  if (input.calendarWebUrl) {
    nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY] = input.calendarWebUrl;
  } else {
    delete nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY];
  }

  if (input.pdfBrandingAssetUrl) {
    nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY] = input.pdfBrandingAssetUrl;
  } else {
    delete nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY];
  }

  if (input.pdfContactBlock) {
    nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY] = input.pdfContactBlock;
  } else {
    delete nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY];
  }

  if (input.holidayStateCode) {
    nextPublicConfig[WASTE_HOLIDAY_STATE_CODE_KEY] = input.holidayStateCode;
  } else {
    delete nextPublicConfig[WASTE_HOLIDAY_STATE_CODE_KEY];
  }

  if (input.lastHolidaySyncStatus) {
    nextPublicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY] = input.lastHolidaySyncStatus;
  } else {
    delete nextPublicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY];
  }

  if (input.lastSuccessfulHolidaySyncAt) {
    nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY] = input.lastSuccessfulHolidaySyncAt;
  } else {
    delete nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY];
  }

  return nextPublicConfig;
};
