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
const WASTE_EMAIL_REMINDER_CONFIG_KEY = 'emailReminderConfig';

const readTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readPositiveInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const readBoundedPositiveInteger = (value: unknown, maximum: number): number | undefined => {
  const parsed = readPositiveInteger(value);
  return parsed !== undefined && parsed <= maximum ? parsed : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readEmail = (value: unknown): string | undefined => {
  const email = readTrimmedString(value);
  return email && EMAIL_PATTERN.test(email) ? email : undefined;
};

const normalizeUrlString = (url: URL): string => url.toString();

const readAbsoluteHttpUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const readPublicBaseUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return normalizeUrlString(parsed);
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' ||
        parsed.hostname.endsWith('.localhost') ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]' ||
        parsed.hostname === '::1')
    ) {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const readRelativePath = (value: unknown): string | undefined => {
  const path = readTrimmedString(value);
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return undefined;
  }
  if (/^[a-z]+:/i.test(path)) {
    return undefined;
  }
  return path;
};

const emailReminderRequiredStringKeys = [
  'transportId',
  'publicBaseUrl',
  'doiConfirmPath',
  'unsubscribePath',
  'fromName',
  'fromEmail',
  'privacyPolicyUrl',
  'imprintUrl',
  'consentLabel',
  'consentVersion',
  'doiSubjectTemplate',
  'doiIntroText',
  'doiButtonLabel',
  'reminderSubjectTemplate',
  'reminderIntroTemplate',
  'unsubscribeLinkLabel',
  'unsubscribeSuccessHeadline',
  'unsubscribeSuccessBody',
] as const;

const emailReminderOptionalStringKeys = [
  'signupSuccessPath',
  'activationSuccessPath',
  'unsubscribeSuccessPath',
  'invalidTokenPath',
  'replyToEmail',
  'serviceLabel',
  'dataControllerLabel',
  'dataProtectionContactEmail',
  'doiPreheader',
  'doiFallbackText',
  'doiExpiryNoticeText',
  'doiSuccessHeadline',
  'doiSuccessBody',
  'doiErrorHeadline',
  'doiErrorBody',
  'reminderListIntroTemplate',
  'reminderOutroText',
  'reminderReasonText',
  'unsubscribeAlreadyDoneHeadline',
  'unsubscribeAlreadyDoneBody',
  'unsubscribeErrorHeadline',
  'unsubscribeErrorBody',
] as const;

const emailReminderRequiredPositiveIntegerKeys = [
  'maxSubscriptionsPerEmailAndLocation',
  'signupRateLimitPerIpPerHour',
  'signupRateLimitPerEmailPerHour',
  'doiTokenTtlHours',
  'pendingSubscriptionTtlHours',
  'materializationLookaheadDays',
] as const;

const emailReminderOptionalPositiveIntegerKeys = ['unsubscribeTokenTtlDays'] as const;
const MAX_MATERIALIZATION_LOOKAHEAD_DAYS = 14;

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

const normalizeWasteManagementEmailReminderConfig = (
  value: unknown
): WasteManagementEmailReminderConfig | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const enabled = readBoolean(record.enabled);
  const publicSignupEnabled = readBoolean(record.publicSignupEnabled);
  if (enabled === undefined || publicSignupEnabled === undefined) {
    return undefined;
  }

  const normalizedRequiredStrings = Object.fromEntries(
    emailReminderRequiredStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as Record<(typeof emailReminderRequiredStringKeys)[number], string | undefined>;

  if (Object.values(normalizedRequiredStrings).some((value) => value === undefined)) {
    return undefined;
  }

  const normalizedRequiredIntegers = Object.fromEntries(
    emailReminderRequiredPositiveIntegerKeys.map((key) => [
      key,
      key === 'materializationLookaheadDays'
        ? readBoundedPositiveInteger(record[key], MAX_MATERIALIZATION_LOOKAHEAD_DAYS)
        : readPositiveInteger(record[key]),
    ])
  ) as Record<(typeof emailReminderRequiredPositiveIntegerKeys)[number], number | undefined>;

  if (Object.values(normalizedRequiredIntegers).some((value) => value === undefined)) {
    return undefined;
  }

  const normalizedOptionalStrings = Object.fromEntries(
    emailReminderOptionalStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as Record<(typeof emailReminderOptionalStringKeys)[number], string | undefined>;

  const normalizedOptionalIntegers = Object.fromEntries(
    emailReminderOptionalPositiveIntegerKeys.map((key) => {
      const rawValue = record[key];
      const parsedValue = readPositiveInteger(rawValue);
      if (rawValue !== undefined && parsedValue === undefined) {
        return [key, null];
      }
      return [key, parsedValue];
    })
  ) as Record<(typeof emailReminderOptionalPositiveIntegerKeys)[number], number | null | undefined>;

  if (Object.values(normalizedOptionalIntegers).some((value) => value === null)) {
    return undefined;
  }

  const publicBaseUrl = readPublicBaseUrl(normalizedRequiredStrings.publicBaseUrl);
  const privacyPolicyUrl = readAbsoluteHttpUrl(normalizedRequiredStrings.privacyPolicyUrl);
  const imprintUrl = readAbsoluteHttpUrl(normalizedRequiredStrings.imprintUrl);
  const doiConfirmPath = readRelativePath(normalizedRequiredStrings.doiConfirmPath);
  const unsubscribePath = readRelativePath(normalizedRequiredStrings.unsubscribePath);
  const fromEmail = readEmail(normalizedRequiredStrings.fromEmail);
  const replyToEmail = normalizedOptionalStrings.replyToEmail ? readEmail(normalizedOptionalStrings.replyToEmail) : undefined;
  const dataProtectionContactEmail = normalizedOptionalStrings.dataProtectionContactEmail
    ? readEmail(normalizedOptionalStrings.dataProtectionContactEmail)
    : undefined;
  const signupSuccessPath = normalizedOptionalStrings.signupSuccessPath
    ? readRelativePath(normalizedOptionalStrings.signupSuccessPath)
    : undefined;
  const activationSuccessPath = normalizedOptionalStrings.activationSuccessPath
    ? readRelativePath(normalizedOptionalStrings.activationSuccessPath)
    : undefined;
  const unsubscribeSuccessPath = normalizedOptionalStrings.unsubscribeSuccessPath
    ? readRelativePath(normalizedOptionalStrings.unsubscribeSuccessPath)
    : undefined;
  const invalidTokenPath = normalizedOptionalStrings.invalidTokenPath
    ? readRelativePath(normalizedOptionalStrings.invalidTokenPath)
    : undefined;

  if (
    !publicBaseUrl ||
    !privacyPolicyUrl ||
    !imprintUrl ||
    !doiConfirmPath ||
    !unsubscribePath ||
    !fromEmail ||
    (normalizedOptionalStrings.replyToEmail && !replyToEmail) ||
    (normalizedOptionalStrings.dataProtectionContactEmail && !dataProtectionContactEmail) ||
    (normalizedOptionalStrings.signupSuccessPath && !signupSuccessPath) ||
    (normalizedOptionalStrings.activationSuccessPath && !activationSuccessPath) ||
    (normalizedOptionalStrings.unsubscribeSuccessPath && !unsubscribeSuccessPath) ||
    (normalizedOptionalStrings.invalidTokenPath && !invalidTokenPath)
  ) {
    return undefined;
  }

  return {
    enabled,
    publicSignupEnabled,
    transportId: normalizedRequiredStrings.transportId!,
    publicBaseUrl,
    doiConfirmPath,
    unsubscribePath,
    fromName: normalizedRequiredStrings.fromName!,
    fromEmail,
    privacyPolicyUrl,
    imprintUrl,
    consentLabel: normalizedRequiredStrings.consentLabel!,
    consentVersion: normalizedRequiredStrings.consentVersion!,
    doiSubjectTemplate: normalizedRequiredStrings.doiSubjectTemplate!,
    doiIntroText: normalizedRequiredStrings.doiIntroText!,
    doiButtonLabel: normalizedRequiredStrings.doiButtonLabel!,
    reminderSubjectTemplate: normalizedRequiredStrings.reminderSubjectTemplate!,
    reminderIntroTemplate: normalizedRequiredStrings.reminderIntroTemplate!,
    unsubscribeLinkLabel: normalizedRequiredStrings.unsubscribeLinkLabel!,
    unsubscribeSuccessHeadline: normalizedRequiredStrings.unsubscribeSuccessHeadline!,
    unsubscribeSuccessBody: normalizedRequiredStrings.unsubscribeSuccessBody!,
    maxSubscriptionsPerEmailAndLocation: normalizedRequiredIntegers.maxSubscriptionsPerEmailAndLocation!,
    signupRateLimitPerIpPerHour: normalizedRequiredIntegers.signupRateLimitPerIpPerHour!,
    signupRateLimitPerEmailPerHour: normalizedRequiredIntegers.signupRateLimitPerEmailPerHour!,
    doiTokenTtlHours: normalizedRequiredIntegers.doiTokenTtlHours!,
    pendingSubscriptionTtlHours: normalizedRequiredIntegers.pendingSubscriptionTtlHours!,
    materializationLookaheadDays: normalizedRequiredIntegers.materializationLookaheadDays!,
    ...(signupSuccessPath ? { signupSuccessPath } : {}),
    ...(activationSuccessPath ? { activationSuccessPath } : {}),
    ...(unsubscribeSuccessPath ? { unsubscribeSuccessPath } : {}),
    ...(invalidTokenPath ? { invalidTokenPath } : {}),
    ...(replyToEmail ? { replyToEmail } : {}),
    ...(normalizedOptionalStrings.serviceLabel ? { serviceLabel: normalizedOptionalStrings.serviceLabel } : {}),
    ...(normalizedOptionalStrings.dataControllerLabel
      ? { dataControllerLabel: normalizedOptionalStrings.dataControllerLabel }
      : {}),
    ...(dataProtectionContactEmail ? { dataProtectionContactEmail } : {}),
    ...(normalizedOptionalStrings.doiPreheader ? { doiPreheader: normalizedOptionalStrings.doiPreheader } : {}),
    ...(normalizedOptionalStrings.doiFallbackText ? { doiFallbackText: normalizedOptionalStrings.doiFallbackText } : {}),
    ...(normalizedOptionalStrings.doiExpiryNoticeText
      ? { doiExpiryNoticeText: normalizedOptionalStrings.doiExpiryNoticeText }
      : {}),
    ...(normalizedOptionalStrings.doiSuccessHeadline
      ? { doiSuccessHeadline: normalizedOptionalStrings.doiSuccessHeadline }
      : {}),
    ...(normalizedOptionalStrings.doiSuccessBody ? { doiSuccessBody: normalizedOptionalStrings.doiSuccessBody } : {}),
    ...(normalizedOptionalStrings.doiErrorHeadline ? { doiErrorHeadline: normalizedOptionalStrings.doiErrorHeadline } : {}),
    ...(normalizedOptionalStrings.doiErrorBody ? { doiErrorBody: normalizedOptionalStrings.doiErrorBody } : {}),
    ...(normalizedOptionalStrings.reminderListIntroTemplate
      ? { reminderListIntroTemplate: normalizedOptionalStrings.reminderListIntroTemplate }
      : {}),
    ...(normalizedOptionalStrings.reminderOutroText ? { reminderOutroText: normalizedOptionalStrings.reminderOutroText } : {}),
    ...(normalizedOptionalStrings.reminderReasonText
      ? { reminderReasonText: normalizedOptionalStrings.reminderReasonText }
      : {}),
    ...(normalizedOptionalStrings.unsubscribeAlreadyDoneHeadline
      ? { unsubscribeAlreadyDoneHeadline: normalizedOptionalStrings.unsubscribeAlreadyDoneHeadline }
      : {}),
    ...(normalizedOptionalStrings.unsubscribeAlreadyDoneBody
      ? { unsubscribeAlreadyDoneBody: normalizedOptionalStrings.unsubscribeAlreadyDoneBody }
      : {}),
    ...(normalizedOptionalStrings.unsubscribeErrorHeadline
      ? { unsubscribeErrorHeadline: normalizedOptionalStrings.unsubscribeErrorHeadline }
      : {}),
    ...(normalizedOptionalStrings.unsubscribeErrorBody
      ? { unsubscribeErrorBody: normalizedOptionalStrings.unsubscribeErrorBody }
      : {}),
    ...(normalizedOptionalIntegers.unsubscribeTokenTtlDays
      ? { unsubscribeTokenTtlDays: normalizedOptionalIntegers.unsubscribeTokenTtlDays }
      : {}),
  };
};

export const isWasteManagementInterfaceSelected = (
  record: Pick<ExternalInterfaceRecord, 'publicConfig'>
): boolean => record.publicConfig[WASTE_SELECTED_INTERFACE_KEY] === true;

export const findSelectedWasteManagementInterfaceRecord = (
  records: readonly ExternalInterfaceRecord[]
): ExternalInterfaceRecord | null =>
  records.find((record) => record.typeKey === 'supabase' && isWasteManagementInterfaceSelected(record)) ??
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

export const readWasteManagementEmailReminderConfig = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteManagementEmailReminderConfig | undefined =>
  normalizeWasteManagementEmailReminderConfig(publicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY]);

export const buildWasteManagementPublicConfig = (
  currentPublicConfig: Readonly<Record<string, unknown>>,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
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

  const normalizedEmailReminderConfig = normalizeWasteManagementEmailReminderConfig(input.emailReminderConfig);
  if (normalizedEmailReminderConfig) {
    nextPublicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY] = normalizedEmailReminderConfig;
  } else if (input.emailReminderConfig === undefined) {
    delete nextPublicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY];
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
