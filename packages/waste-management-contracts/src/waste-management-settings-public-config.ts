import type { ExternalInterfaceRecord } from '@sva/core';
import type { WasteHolidayStateCode } from './waste-management/master-data-contract.js';
import { readTrimmedString } from './waste-management-email-reminder.values.js';
import { normalizeWasteManagementEmailReminderConfig } from './waste-management-email-reminder.normalize.js';
import { wasteManagementMasterDataContract } from './waste-management-master-data.js';
import {
  wasteManagementDataSourceContract,
  type WasteHolidaySyncStatus,
} from './waste-management-contract.js';

const WASTE_SELECTED_INTERFACE_KEY = 'wasteManagementSelected';
const WASTE_CALENDAR_WEB_URL_KEY = 'calendarWebUrl';
const WASTE_PDF_BRANDING_ASSET_URL_KEY = 'pdfBrandingAssetUrl';
const WASTE_PDF_CONTACT_BLOCK_KEY = 'pdfContactBlock';
const WASTE_HOLIDAY_STATE_CODE_KEY = 'holidayStateCode';
const WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY = 'lastHolidaySyncStatus';
const WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY = 'lastSuccessfulHolidaySyncAt';
const WASTE_EMAIL_REMINDER_CONFIG_KEY = 'emailReminderConfig';
const WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY = 'emailReminderSigningSecret';

export type WasteManagementEmailReminderConfig = Readonly<{
  enabled: boolean;
  publicSignupEnabled: boolean;
  transportId: string;
  publicBaseUrl: string;
  doiConfirmPath: string;
  unsubscribePath: string;
  signupSuccessPath?: string;
  activationSuccessPath?: string;
  unsubscribeSuccessPath?: string;
  invalidTokenPath?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  serviceLabel?: string;
  privacyPolicyUrl: string;
  imprintUrl: string;
  consentLabel: string;
  consentVersion: string;
  dataControllerLabel?: string;
  dataProtectionContactEmail?: string;
  doiSubjectTemplate: string;
  doiPreheader?: string;
  doiIntroText: string;
  doiButtonLabel: string;
  doiFallbackText?: string;
  doiExpiryNoticeText?: string;
  doiSuccessHeadline?: string;
  doiSuccessBody?: string;
  doiErrorHeadline?: string;
  doiErrorBody?: string;
  reminderSubjectTemplate: string;
  reminderIntroTemplate: string;
  reminderListIntroTemplate?: string;
  reminderOutroText?: string;
  unsubscribeLinkLabel: string;
  reminderReasonText?: string;
  unsubscribeSuccessHeadline: string;
  unsubscribeSuccessBody: string;
  unsubscribeAlreadyDoneHeadline?: string;
  unsubscribeAlreadyDoneBody?: string;
  unsubscribeErrorHeadline?: string;
  unsubscribeErrorBody?: string;
  maxSubscriptionsPerEmailAndLocation: number;
  signupRateLimitPerIpPerHour: number;
  signupRateLimitPerEmailPerHour: number;
  doiTokenTtlHours: number;
  pendingSubscriptionTtlHours: number;
  materializationLookaheadDays: number;
  unsubscribeTokenTtlDays?: number;
}>;
export const isWasteManagementInterfaceSelected = (
  record: Pick<ExternalInterfaceRecord, 'publicConfig'>
): boolean => record.publicConfig[WASTE_SELECTED_INTERFACE_KEY] === true;

export const findSelectedWasteManagementInterfaceRecord = (
  records: readonly ExternalInterfaceRecord[]
): ExternalInterfaceRecord | null =>
  records.find(
    (record) => record.typeKey === 'postgresql' && isWasteManagementInterfaceSelected(record)
  ) ??
  records.find((record) => record.typeKey === 'postgresql' && record.isDefault) ??
  records.find((record) => record.typeKey === 'postgresql') ??
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
  return typeof value === 'string' &&
    wasteManagementMasterDataContract.isWasteHolidayStateCode(value)
    ? value
    : undefined;
};

export const readWasteManagementHolidaySyncStatus = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteHolidaySyncStatus | undefined => {
  const value = publicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY];
  return typeof value === 'string' && wasteManagementDataSourceContract.isHolidaySyncStatus(value)
    ? value
    : undefined;
};

export const readWasteManagementLastSuccessfulHolidaySyncAt = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY]);

export const readWasteManagementEmailReminderConfig = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteManagementEmailReminderConfig | undefined =>
  normalizeWasteManagementEmailReminderConfig(publicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY]);

export const readWasteManagementEmailReminderSigningSecret = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined =>
  readWasteManagementEmailReminderConfig(publicConfig)
    ? readTrimmedString(publicConfig[WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY])
    : undefined;

export const buildWasteManagementPublicConfig = (
  currentPublicConfig: Readonly<Record<string, unknown>>,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
    readonly emailReminderSigningSecret?: string;
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

  const calendarWebUrl = readTrimmedString(input.calendarWebUrl);
  if (calendarWebUrl) {
    nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY] = calendarWebUrl;
  } else {
    delete nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY];
  }

  const pdfBrandingAssetUrl = readTrimmedString(input.pdfBrandingAssetUrl);
  if (pdfBrandingAssetUrl) {
    nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY] = pdfBrandingAssetUrl;
  } else {
    delete nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY];
  }

  const pdfContactBlock = readTrimmedString(input.pdfContactBlock);
  if (pdfContactBlock) {
    nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY] = pdfContactBlock;
  } else {
    delete nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY];
  }

  const normalizedEmailReminderConfig = normalizeWasteManagementEmailReminderConfig(
    input.emailReminderConfig
  );
  if (normalizedEmailReminderConfig) {
    nextPublicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY] = normalizedEmailReminderConfig;
  }

  const emailReminderSigningSecret = readTrimmedString(input.emailReminderSigningSecret);
  if (emailReminderSigningSecret) {
    nextPublicConfig[WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY] = emailReminderSigningSecret;
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

  const lastSuccessfulHolidaySyncAt = readTrimmedString(input.lastSuccessfulHolidaySyncAt);
  if (lastSuccessfulHolidaySyncAt) {
    nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY] = lastSuccessfulHolidaySyncAt;
  } else {
    delete nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY];
  }

  return nextPublicConfig;
};
